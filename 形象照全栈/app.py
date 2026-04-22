import json
import base64
import hashlib
import shutil
import sqlite3
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from flask import Flask, render_template, request, jsonify
import time
import os

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'impeccable.db'
UPLOAD_DIR = BASE_DIR / 'static' / 'uploads'
GENERATED_DIR = BASE_DIR / 'static' / 'generated'
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}
DOUBAO_DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

def load_env_file():
    env_path = BASE_DIR / '.env'
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ[key.strip()] = value.strip().strip('"').strip("'")

load_env_file()

# --- Database Setup ---
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Users table
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, 
                    email TEXT, 
                    name TEXT, 
                    password_hash TEXT,
                    register_time INTEGER)''')
    # Messages table
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, 
                    user_id TEXT,
                    is_admin INTEGER,
                    content TEXT,
                    timestamp INTEGER)''')
    c.execute('''CREATE TABLE IF NOT EXISTS uploaded_photos (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    original_name TEXT,
                    file_path TEXT,
                    public_url TEXT,
                    created_at INTEGER)''')
    c.execute('''CREATE TABLE IF NOT EXISTS generation_batches (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    source_photo_ids TEXT,
                    style_config TEXT,
                    status TEXT,
                    created_at INTEGER)''')
    c.execute('''CREATE TABLE IF NOT EXISTS generated_images (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT,
                    label TEXT,
                    file_path TEXT,
                    public_url TEXT,
                    created_at INTEGER)''')
    c.execute('''CREATE TABLE IF NOT EXISTS user_credits (
                    user_id TEXT PRIMARY KEY,
                    balance INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS credit_transactions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    reason TEXT NOT NULL,
                    batch_id TEXT,
                    created_at INTEGER NOT NULL)''')
    existing_columns = {row[1] for row in c.execute('PRAGMA table_info(users)').fetchall()}
    if 'password_hash' not in existing_columns:
        c.execute('ALTER TABLE users ADD COLUMN password_hash TEXT')
    existing_columns = {row[1] for row in c.execute('PRAGMA table_info(generation_batches)').fetchall()}
    if 'client_request_id' not in existing_columns:
        c.execute('ALTER TABLE generation_batches ADD COLUMN client_request_id TEXT')
    conn.commit()
    conn.close()

init_db()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('ascii'), 120000).hex()
    return f'pbkdf2_sha256${salt}${digest}'

def verify_password(password, stored_hash):
    if not stored_hash:
        return False
    if stored_hash.startswith('pbkdf2_sha256$'):
        _, salt, digest = stored_hash.split('$', 2)
        candidate = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('ascii'), 120000).hex()
        return candidate == digest
    return hashlib.sha256(password.encode('utf-8')).hexdigest() == stored_hash

def is_allowed_image(filename):
    return Path(filename or '').suffix.lower() in ALLOWED_EXTENSIONS

def image_quality_status(file_storage):
    size = request.content_length or 0
    if size > 12 * 1024 * 1024:
        return 'error', '单张照片超过 12MB，请压缩后重新上传。'
    if not is_allowed_image(file_storage.filename):
        return 'error', '仅支持 JPG、PNG、WEBP 或 HEIC 图片。'
    return 'success', '照片已通过基础格式校验。'

def photo_public_url(path):
    return '/' + path.relative_to(BASE_DIR).as_posix()

def get_generation_labels():
    return [
        '职业形象照',
    ]

def ensure_user_credits(conn, user_id):
    row = conn.execute('SELECT balance FROM user_credits WHERE user_id = ?', (user_id,)).fetchone()
    if row:
        return int(row['balance'])
    now = int(time.time() * 1000)
    conn.execute(
        'INSERT INTO user_credits (user_id, balance, updated_at) VALUES (?, ?, ?)',
        (user_id, 20, now),
    )
    conn.execute(
        '''INSERT INTO credit_transactions
           (id, user_id, amount, reason, batch_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)''',
        ('txn_' + uuid.uuid4().hex[:12], user_id, 20, 'initial_grant', None, now),
    )
    return 20

def mime_type_for(path):
    ext = path.suffix.lower()
    if ext in {'.jpg', '.jpeg'}:
        return 'image/jpeg'
    if ext == '.png':
        return 'image/png'
    if ext == '.webp':
        return 'image/webp'
    return 'application/octet-stream'

def image_to_base64(path):
    encoded = base64.b64encode(path.read_bytes()).decode('ascii')
    if os.getenv('DOUBAO_INPUT_IMAGE_FORMAT', 'base64').lower() == 'data_url':
        return f'data:{mime_type_for(path)};base64,{encoded}'
    return encoded

def validate_public_image_url(image_url):
    parsed = urlparse(image_url)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        raise RuntimeError('豆包参考图地址无效：image 必须是可公开访问的 http/https URL。')
    if parsed.hostname in {'localhost', '127.0.0.1', '0.0.0.0'}:
        raise RuntimeError('豆包无法访问本机地址。请配置 DOUBAO_PUBLIC_BASE_URL 为公网 HTTPS 地址。')
    return image_url

def resolve_reference_image_url(source_path):
    override_url = os.getenv('DOUBAO_REFERENCE_IMAGE_URL')
    if override_url:
        return validate_public_image_url(override_url)

    public_base_url = os.getenv('DOUBAO_PUBLIC_BASE_URL', '').strip().rstrip('/')
    if not public_base_url:
        raise RuntimeError(
            '豆包图生图接口要求 image 是公网图片 URL。请先用 ngrok/线上域名暴露本站，'
            '并在 .env 中设置 DOUBAO_PUBLIC_BASE_URL。'
        )

    return validate_public_image_url(public_base_url + photo_public_url(source_path))

def build_headshot_prompt(label, style_config):
    crop_text = '半身职业头像' if style_config.get('crop') != 'full' else '全身职业形象照'
    jacket = style_config.get('jacket') or '标准单排扣西装'
    jacket_color = color_name(style_config.get('jacketColor')) or '深海军蓝'
    shirt = style_config.get('shirt') or '标准温莎领衬衫'
    shirt_color = color_name(style_config.get('shirtColor')) or '白色'
    pants = style_config.get('pants') or '标准微直筒西裤'
    pants_color = color_name(style_config.get('pantsColor')) or '深海军蓝'
    shoes = style_config.get('shoes') or '牛津皮鞋'
    shoes_color = color_name(style_config.get('shoesColor')) or '棕色'
    full_body_text = ''
    if style_config.get('crop') == 'full':
        full_body_text = f' 下装必须是{pants_color}{pants}，鞋履必须是{shoes_color}{shoes}，整体比例自然修长。'
    return (
        f'基于参考自拍生成一张真实自然的{crop_text}，风格为{label}。'
        f'保持人物身份、五官比例、脸型、发际线和发型高度一致；服装必须严格使用用户选择：'
        f'外套为{jacket_color}{jacket}，内搭为{shirt_color}{shirt}。'
        f'{full_body_text}'
        '使用专业摄影棚布光，干净商务背景，真实皮肤质感，眼神自然，自信但不过度美颜。'
        '不要改变人物年龄、性别和面部特征，不要生成多人，不要添加文字、水印或夸张滤镜。'
    )

def color_name(value):
    if not value:
        return ''
    names = {
        'navy': '深海军蓝',
        'charcoal': '炭灰色',
        'ivory': '象牙白',
        'khaki': '卡其色',
        'white': '白色',
        'lightblue': '浅蓝色',
        'black': '黑色',
        'brown': '棕色',
    }
    return names.get(str(value).strip().lower(), str(value).strip())

def save_remote_image(image_url, target_path):
    req = Request(image_url, headers={'User-Agent': 'AuralisHeadshot/1.0'})
    with urlopen(req, timeout=120) as response:
        target_path.write_bytes(response.read())

def save_b64_image(b64_json, target_path):
    if ',' in b64_json and b64_json.startswith('data:'):
        b64_json = b64_json.split(',', 1)[1]
    target_path.write_bytes(base64.b64decode(b64_json))

def response_image_items(payload):
    if isinstance(payload.get('data'), list):
        return payload['data']
    if isinstance(payload.get('images'), list):
        return payload['images']
    if isinstance(payload.get('result'), dict) and isinstance(payload['result'].get('data'), list):
        return payload['result']['data']
    return []

def call_doubao_seedream(source_path, label, style_config, target_path):
    api_key = os.getenv('DOUBAO_API_KEY') or os.getenv('ARK_API_KEY')
    if not api_key:
        raise RuntimeError('缺少 DOUBAO_API_KEY，请先在 .env 中配置豆包 API Key。')

    api_url = os.getenv('DOUBAO_API_URL', DOUBAO_DEFAULT_API_URL)
    base_url = os.getenv('DOUBAO_BASE_URL')
    if base_url and not os.getenv('DOUBAO_API_URL'):
        api_url = base_url.rstrip('/') + '/images/generations'

    model = os.getenv('DOUBAO_MODEL', 'doubao-seedream-5-0-260128')
    image_value = resolve_reference_image_url(source_path)
    body = {
        'model': model,
        'prompt': build_headshot_prompt(label, style_config),
        'image': image_value,
        'size': os.getenv('DOUBAO_IMAGE_SIZE', '2K'),
        'sequential_image_generation': 'disabled',
        'stream': False,
        'response_format': os.getenv('DOUBAO_RESPONSE_FORMAT', 'url'),
        'watermark': False,
    }

    req = Request(
        api_url,
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
        },
        method='POST',
    )
    try:
        with urlopen(req, timeout=int(os.getenv('DOUBAO_TIMEOUT_SECONDS', '180'))) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except HTTPError as error:
        details = error.read().decode('utf-8', errors='replace')
        app.logger.error('Doubao image generation failed: status=%s body=%s', error.code, details[:1000])
        raise RuntimeError(f'豆包生成接口返回 {error.code}: {details[:300]}') from error
    except URLError as error:
        app.logger.error('Doubao image generation connection failed: %s', error.reason)
        raise RuntimeError(f'无法连接豆包生成接口: {error.reason}') from error

    items = response_image_items(payload)
    if not items:
        app.logger.error('Doubao image generation returned no image items: %s', json.dumps(payload, ensure_ascii=False)[:1000])
        raise RuntimeError('豆包接口未返回图片数据。')

    first = items[0]
    image_url = first.get('url') or first.get('image_url')
    b64_json = first.get('b64_json') or first.get('base64')
    if image_url:
        save_remote_image(image_url, target_path)
    elif b64_json:
        save_b64_image(b64_json, target_path)
    else:
        raise RuntimeError('豆包接口返回中没有 url 或 b64_json。')

def copy_mock_image(source_path, target_path):
    shutil.copyfile(source_path, target_path)

def generate_image_asset(source_path, label, style_config, target_path):
    provider = os.getenv('IMAGE_GENERATION_PROVIDER', 'mock').lower()
    if provider == 'doubao':
        try:
            call_doubao_seedream(source_path, label, style_config, target_path)
            return 'doubao'
        except Exception:
            if os.getenv('DOUBAO_ALLOW_MOCK_FALLBACK', 'false').lower() != 'true':
                raise
    copy_mock_image(source_path, target_path)
    return 'mock'

# --- Auth API Routes ---
@app.route('/api/auth/register', methods=['POST'])
def register_user():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not name or '@' not in email or len(password) < 8:
        return jsonify({'success': False, 'error': '请填写用户名、有效邮箱和至少 8 位密码。'}), 400

    conn = get_db()
    existing = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'success': False, 'error': '该邮箱已经注册，请直接登录。'}), 409

    user_id = 'u_' + uuid.uuid4().hex[:12]
    conn.execute(
        '''INSERT INTO users (id, email, name, password_hash, register_time)
           VALUES (?, ?, ?, ?, ?)''',
        (user_id, email, name, hash_password(password), int(time.time() * 1000)),
    )
    ensure_user_credits(conn, user_id)
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'user': {'id': user_id, 'name': name, 'email': email}})

@app.route('/api/auth/login', methods=['POST'])
def login_user():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if not user or not verify_password(password, user['password_hash']):
        conn.close()
        return jsonify({'success': False, 'error': '邮箱或密码不正确。'}), 401
    ensure_user_credits(conn, user['id'])
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'user': {'id': user['id'], 'name': user['name'], 'email': user['email']}})

# --- Chat API Routes ---
@app.route('/api/chat', methods=['POST'])
def send_message():
    data = request.json
    user_id = data.get('userId', 'anonymous')
    is_admin = data.get('isAdmin', 0)
    content = data.get('content', '')
    
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO messages (user_id, is_admin, content, timestamp) VALUES (?, ?, ?, ?)",
              (user_id, is_admin, content, int(time.time() * 1000)))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/chat', methods=['GET'])
def get_messages():
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify([])
    
    conn = get_db()
    c = conn.cursor()
    if user_id == 'admin_all':
        c.execute("SELECT * FROM messages ORDER BY timestamp ASC")
    else:
        c.execute("SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp ASC", (user_id,))
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in rows])

@app.route('/api/chat/users', methods=['GET'])
def get_chat_users():
    # Admin API to get list of distinct users who have sent messages
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT DISTINCT user_id FROM messages WHERE is_admin = 0")
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(ix)['user_id'] for ix in rows])

# --- Image Pipeline API Routes ---
@app.route('/api/upload', methods=['POST'])
def upload_photo():
    user_id = request.form.get('userId', 'anonymous')
    file_storage = request.files.get('photo')
    if not file_storage or file_storage.filename == '':
        return jsonify({'success': False, 'error': '没有收到图片文件。'}), 400

    status, message = image_quality_status(file_storage)
    if status == 'error':
        return jsonify({'success': False, 'status': status, 'error': message}), 400

    ext = Path(file_storage.filename).suffix.lower() or '.jpg'
    photo_id = 'photo_' + uuid.uuid4().hex[:12]
    save_path = UPLOAD_DIR / f'{photo_id}{ext}'
    file_storage.save(save_path)

    public_url = photo_public_url(save_path)
    conn = get_db()
    conn.execute(
        '''INSERT INTO uploaded_photos
           (id, user_id, original_name, file_path, public_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (photo_id, user_id, file_storage.filename, str(save_path), public_url, int(time.time() * 1000)),
    )
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'photo': {
            'id': photo_id,
            'name': file_storage.filename,
            'url': public_url,
            'status': status,
            'message': message,
        }
    })

@app.route('/api/generate', methods=['POST'])
def generate_images():
    data = request.get_json(silent=True) or {}
    user_id = data.get('userId', 'anonymous')
    photo_ids = data.get('photoIds') or []
    style_config = data.get('styleConfig') or {}
    client_request_id = (data.get('clientRequestId') or '').strip()

    if not photo_ids:
        return jsonify({'success': False, 'error': '请先上传至少 1 张照片再生成。'}), 400

    conn = get_db()
    if client_request_id:
        existing = conn.execute(
            'SELECT id, status FROM generation_batches WHERE user_id = ? AND client_request_id = ?',
            (user_id, client_request_id),
        ).fetchone()
        if existing:
            images = conn.execute(
                'SELECT id, label, public_url FROM generated_images WHERE batch_id = ? ORDER BY id ASC',
                (existing['id'],),
            ).fetchall()
            conn.close()
            return jsonify({
                'success': True,
                'batch': {
                    'id': existing['id'],
                    'status': existing['status'],
                    'count': len(images),
                    'images': [{'id': row['id'], 'label': row['label'], 'url': row['public_url']} for row in images],
                },
                'reused': True,
            })

    placeholders = ','.join('?' for _ in photo_ids)
    rows = conn.execute(
        f'SELECT * FROM uploaded_photos WHERE user_id = ? AND id IN ({placeholders})',
        [user_id] + photo_ids,
    ).fetchall()
    if not rows:
        conn.close()
        return jsonify({'success': False, 'error': '没有找到可用于生成的上传照片。'}), 400

    source = rows[0]
    source_path = Path(source['file_path'])
    if not source_path.exists():
        conn.close()
        return jsonify({'success': False, 'error': '源照片文件已丢失，请重新上传。'}), 400

    batch_id = 'gen_' + uuid.uuid4().hex[:12]
    labels = get_generation_labels()
    ext = source_path.suffix.lower() or '.jpg'
    now = int(time.time() * 1000)
    conn.execute(
        '''INSERT INTO generation_batches
           (id, user_id, source_photo_ids, style_config, status, created_at, client_request_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (batch_id, user_id, json.dumps(photo_ids), json.dumps(style_config), 'preview', now, client_request_id or None),
    )

    images = []
    for index, label in enumerate(labels, start=1):
        image_id = f'{batch_id}_{index}'
        target_path = GENERATED_DIR / f'{image_id}{ext}'
        try:
            provider = generate_image_asset(source_path, label, style_config, target_path)
        except Exception as error:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'error': str(error)}), 502
        public_url = photo_public_url(target_path)
        conn.execute(
            '''INSERT INTO generated_images
               (id, batch_id, label, file_path, public_url, created_at)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (image_id, batch_id, label, str(target_path), public_url, now),
        )
        images.append({'id': image_id, 'label': label, 'url': public_url, 'provider': provider})

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'batch': {'id': batch_id, 'status': 'preview', 'count': len(images), 'images': images}})

@app.route('/api/assets', methods=['GET'])
def list_assets():
    user_id = request.args.get('userId', 'anonymous')
    conn = get_db()
    batches = conn.execute(
        '''SELECT * FROM generation_batches
           WHERE user_id = ?
           ORDER BY created_at DESC''',
        (user_id,),
    ).fetchall()

    assets = []
    for batch in batches:
        images = conn.execute(
            '''SELECT id, label, public_url
               FROM generated_images
               WHERE batch_id = ?
               ORDER BY created_at ASC, id ASC''',
            (batch['id'],),
        ).fetchall()
        image_items = [{'id': row['id'], 'label': row['label'], 'url': row['public_url']} for row in images]
        assets.append({
            'id': batch['id'],
            'timestamp': batch['created_at'],
            'status': batch['status'],
            'count': len(image_items),
            'coverUrl': image_items[0]['url'] if image_items else '',
            'images': image_items,
        })

    conn.close()
    return jsonify({'success': True, 'assets': assets})

@app.route('/api/credits', methods=['GET'])
def get_credits():
    user_id = request.args.get('userId', 'anonymous')
    conn = get_db()
    balance = ensure_user_credits(conn, user_id)
    transactions = conn.execute(
        '''SELECT amount, reason, batch_id, created_at
           FROM credit_transactions
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 20''',
        (user_id,),
    ).fetchall()
    conn.commit()
    conn.close()
    return jsonify({
        'success': True,
        'balance': balance,
        'transactions': [dict(row) for row in transactions],
    })

@app.route('/api/credits/topup', methods=['POST'])
def topup_credits():
    data = request.get_json(silent=True) or {}
    user_id = data.get('userId', 'anonymous')
    amount = int(data.get('amount') or 0)
    method = data.get('method') or 'manual'
    if amount <= 0:
        return jsonify({'success': False, 'error': '充值点数必须大于 0。'}), 400

    conn = get_db()
    balance = ensure_user_credits(conn, user_id) + amount
    now = int(time.time() * 1000)
    conn.execute(
        'UPDATE user_credits SET balance = ?, updated_at = ? WHERE user_id = ?',
        (balance, now, user_id),
    )
    conn.execute(
        '''INSERT INTO credit_transactions
           (id, user_id, amount, reason, batch_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)''',
        ('txn_' + uuid.uuid4().hex[:12], user_id, amount, f'topup_{method}', None, now),
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'balance': balance})

@app.route('/api/batches/<batch_id>', methods=['GET'])
def get_batch(batch_id):
    conn = get_db()
    batch = conn.execute('SELECT * FROM generation_batches WHERE id = ?', (batch_id,)).fetchone()
    if not batch:
        conn.close()
        return jsonify({'success': False, 'error': '生成批次不存在。'}), 404
    images = conn.execute(
        'SELECT id, label, public_url FROM generated_images WHERE batch_id = ? ORDER BY id ASC',
        (batch_id,),
    ).fetchall()
    conn.close()
    return jsonify({
        'success': True,
        'batch': {
            'id': batch['id'],
            'status': batch['status'],
            'images': [{'id': row['id'], 'label': row['label'], 'url': row['public_url']} for row in images],
        }
    })

@app.route('/api/batches/<batch_id>/unlock', methods=['POST'])
def unlock_batch(batch_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    batch = conn.execute('SELECT * FROM generation_batches WHERE id = ?', (batch_id,)).fetchone()
    if not batch:
        conn.close()
        return jsonify({'success': False, 'error': '生成批次不存在。'}), 404

    user_id = data.get('userId') or batch['user_id'] or 'anonymous'
    if batch['status'] == 'unlocked':
        balance = ensure_user_credits(conn, user_id)
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'balance': balance, 'alreadyUnlocked': True})

    balance = ensure_user_credits(conn, user_id)
    if balance < 1:
        conn.close()
        return jsonify({'success': False, 'error': '积分余额不足，请先补充算力。'}), 402

    now = int(time.time() * 1000)
    new_balance = balance - 1
    conn.execute('UPDATE generation_batches SET status = ? WHERE id = ?', ('unlocked', batch_id))
    conn.execute(
        'UPDATE user_credits SET balance = ?, updated_at = ? WHERE user_id = ?',
        (new_balance, now, user_id),
    )
    conn.execute(
        '''INSERT INTO credit_transactions
           (id, user_id, amount, reason, batch_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)''',
        ('txn_' + uuid.uuid4().hex[:12], user_id, -1, 'unlock_image', batch_id, now),
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'balance': new_balance})

@app.route('/api/account/delete', methods=['POST'])
def delete_account_data():
    data = request.get_json(silent=True) or {}
    user_id = data.get('userId')
    confirmation = data.get('confirmation')
    if not user_id or confirmation != 'DELETE':
        return jsonify({'success': False, 'error': '删除确认失败。'}), 400

    conn = get_db()
    upload_rows = conn.execute('SELECT file_path FROM uploaded_photos WHERE user_id = ?', (user_id,)).fetchall()
    batch_rows = conn.execute('SELECT id FROM generation_batches WHERE user_id = ?', (user_id,)).fetchall()
    batch_ids = [row['id'] for row in batch_rows]

    generated_rows = []
    if batch_ids:
        placeholders = ','.join('?' for _ in batch_ids)
        generated_rows = conn.execute(
            f'SELECT file_path FROM generated_images WHERE batch_id IN ({placeholders})',
            batch_ids,
        ).fetchall()
        conn.execute(f'DELETE FROM generated_images WHERE batch_id IN ({placeholders})', batch_ids)

    for row in list(upload_rows) + list(generated_rows):
        path = Path(row['file_path'])
        if path.exists() and BASE_DIR in path.resolve().parents:
            path.unlink()

    conn.execute('DELETE FROM uploaded_photos WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM generation_batches WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM messages WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM credit_transactions WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM user_credits WHERE user_id = ?', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# --- Frontend Template Engine Routes ---
@app.route('/')
def route_index(): return render_template('index.html')

@app.route('/dashboard.html')
def route_dash(): return render_template('dashboard.html')

@app.route('/admin.html')
def route_admin(): return render_template('admin.html')

@app.route('/<path:filename>')
def serve_html(filename):
    if filename.endswith('.html'):
        if (BASE_DIR / 'templates' / filename).exists():
            return render_template(filename)
    return "Not Found", 404

if __name__ == '__main__':
    print("Fullstack server starting at http://127.0.0.1:5000 ...")
    app.run(debug=True, port=5000)
