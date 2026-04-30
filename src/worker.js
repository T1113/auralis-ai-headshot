const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 120000;
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_INITIAL_CREDITS = 1000;
const DEFAULT_GENERATION_COST_CREDITS = 100;
const DEFAULT_FREE_REGENERATIONS = 2;
const DEFAULT_TOP_UP_CREDITS = 1000;
const DEFAULT_TOP_UP_AMOUNT_CENTS = 9900;
const ARK_IMAGE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_IMAGE_GENERATIONS_PATH = "/images/generations";
const ARK_SEEDREAM_IMAGE_MODEL = "doubao-seedream-5-0-260128";
const DEFAULT_RESULT_COUNT = 5;
let billingSchemaReady = false;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);
const RESULT_LABELS = [
  "经典商务浅灰底",
  "领英专属蓝底",
  "自然光高级灰",
  "暖光极简白",
  "户外虚化自然光"
];
const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/gallery.html",
  "/enterprise.html",
  "/faq.html",
  "/privacy.html",
  "/terms.html",
  "/tutorial.html"
];
const PRIVATE_PATH_PREFIXES = [
  "/login",
  "/upload",
  "/style",
  "/checkout",
  "/generating",
  "/result",
  "/dashboard",
  "/support",
  "/admin"
];

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return withHeaders(new Response(null, { status: 204 }), request);
      }

      if (url.pathname === "/robots.txt") {
        return withHeaders(buildRobotsResponse(url), request);
      }

      if (url.pathname === "/sitemap.xml") {
        return withHeaders(buildSitemapResponse(url), request);
      }

      if (url.pathname.startsWith("/api/")) {
        await ensureBillingSchema(env);
        return withHeaders(await handleApiRequest(request, env, url, ctx), request);
      }

      if (url.pathname.startsWith("/media/uploads/")) {
        return withHeaders(await handleUploadMediaRequest(request, env, url), request);
      }

      return withHeaders(await handleAssetRequest(request, env, url), request);
    } catch (error) {
      console.error("Unhandled worker error", error);
      return withHeaders(
        jsonResponse(
          {
            error: "服务暂时不可用，请稍后再试。"
          },
          500
        ),
        request
      );
    }
  }
};

async function handleAssetRequest(request, env, url) {
  let response = await env.ASSETS.fetch(request);

  if (response.status === 404 && !hasFileExtension(url.pathname)) {
    const htmlUrl = new URL(url.toString());
    htmlUrl.pathname = `${trimTrailingSlash(htmlUrl.pathname)}.html`;
    response = await env.ASSETS.fetch(new Request(htmlUrl.toString(), request));
  }

  return response;
}

async function handleUploadMediaRequest(request, env, url) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const uploadId = url.pathname.split("/").pop();
  if (!uploadId) {
    return jsonResponse({ error: "图片不存在。" }, 404);
  }

  const upload = await env.DB.prepare(
    `SELECT id, user_id, object_key, mime_type, file_name
     FROM uploads
     WHERE id = ?`
  )
    .bind(uploadId)
    .first();

  if (!upload || upload.user_id !== session.user.id) {
    return jsonResponse({ error: "无法访问该图片。" }, 404);
  }

  const object = await env.UPLOADS.get(upload.object_key);
  if (!object) {
    return jsonResponse({ error: "图片不存在。" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", upload.mime_type || headers.get("Content-Type") || "application/octet-stream");
  headers.set("Content-Disposition", `inline; filename="${encodeRFC5987(upload.file_name)}"`);
  headers.set("Cache-Control", "private, max-age=300");

  return new Response(object.body, {
    status: 200,
    headers
  });
}

async function handleApiRequest(request, env, url, ctx) {
  const { pathname } = url;

  if (pathname === "/api/auth/register" && request.method === "POST") {
    return handleRegister(request, env);
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return handleLogout(request, env);
  }

  if (pathname === "/api/auth/session" && request.method === "GET") {
    return handleSession(request, env);
  }

  if (pathname === "/api/payments/wechat/prepay" && request.method === "POST") {
    return handleWeChatPrepay(request, env);
  }

  if (pathname === "/api/payments/wechat/mock-confirm" && request.method === "POST") {
    return handleMockPaymentConfirm(request, env);
  }

  if (pathname === "/api/payments/wechat/notify" && request.method === "POST") {
    return handleWeChatPaymentNotify(request, env);
  }

  if (pathname.startsWith("/api/payments/") && request.method === "GET") {
    return handlePaymentStatus(request, env, pathname);
  }

  if (pathname === "/api/leads/contact" && request.method === "POST") {
    return handleLeadSubmission(request, env);
  }

  if (pathname === "/api/uploads" && request.method === "POST") {
    return handleUploadSubmission(request, env);
  }

  if (pathname === "/api/jobs" && request.method === "POST") {
    return handleJobCreation(request, env, ctx);
  }

  if (pathname === "/api/jobs" && request.method === "GET") {
    return handleJobList(request, env);
  }

  if (pathname.startsWith("/api/jobs/") && pathname.endsWith("/unlock") && request.method === "POST") {
    return handleUnlockJob(request, env, pathname);
  }

  if (pathname.startsWith("/api/jobs/") && pathname.endsWith("/regenerate") && request.method === "POST") {
    return handleRegenerateJob(request, env, pathname);
  }

  if (pathname.startsWith("/api/jobs/") && pathname.includes("/results/") && pathname.endsWith("/download") && request.method === "GET") {
    return handleResultDownload(request, env, pathname, url);
  }

  if (pathname.startsWith("/api/jobs/") && pathname.endsWith("/download") && request.method === "GET") {
    return handleJobArchiveDownload(request, env, pathname, url);
  }

  if (pathname.startsWith("/api/jobs/") && request.method === "GET") {
    return handleJobDetail(request, env, pathname);
  }

  if (pathname === "/api/chat" && request.method === "POST") {
    return handleChatMessageSend(request, env);
  }

  if (pathname === "/api/chat" && request.method === "GET") {
    return handleChatMessages(request, env, url);
  }

  if (pathname === "/api/chat/users" && request.method === "GET") {
    return handleChatUsers(request, env);
  }

  if (pathname === "/api/admin/summary" && request.method === "GET") {
    return handleAdminSummary(request, env);
  }

  return jsonResponse({ error: "接口不存在。" }, 404);
}

async function handleRegister(request, env) {
  const payload = await readJson(request);
  const name = sanitizeText(payload?.name, 40);
  const email = normaliseEmail(payload?.email);
  const password = String(payload?.password || "");

  if (!name) {
    return jsonResponse({ error: "请输入用户名或昵称。" }, 400);
  }

  if (!isValidEmail(email)) {
    return jsonResponse({ error: "请输入正确的邮箱地址。" }, 400);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return jsonResponse({ error: passwordError }, 400);
  }

  const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existingUser) {
    return jsonResponse({ error: "该邮箱已注册，请直接登录。" }, 409);
  }

  const userId = randomId("usr");
  const saltHex = randomHex(16);
  const passwordHash = await derivePasswordHash(password, saltHex);
  const now = Date.now();
  const role = matchAdminEmail(email, env.ADMIN_EMAILS) ? "admin" : "user";

  await env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, password_salt, role, credits, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(userId, email, name, passwordHash, saltHex, role, DEFAULT_INITIAL_CREDITS, now, now)
    .run();

  return createSessionResponse(env, request, {
    id: userId,
    email,
    name,
    role,
    credits: DEFAULT_INITIAL_CREDITS
  });
}

async function handleLogin(request, env) {
  const payload = await readJson(request);
  const email = normaliseEmail(payload?.email);
  const password = String(payload?.password || "");

  if (!isValidEmail(email) || !password) {
    return jsonResponse({ error: "请填写正确的邮箱与密码。" }, 400);
  }

  const user = await env.DB.prepare(
    `SELECT id, email, name, role, credits, password_hash, password_salt
     FROM users
     WHERE email = ?`
  )
    .bind(email)
    .first();

  if (!user) {
    return jsonResponse({ error: "账号或密码错误。" }, 401);
  }

  const passwordHash = await derivePasswordHash(password, user.password_salt);
  if (passwordHash !== user.password_hash) {
    return jsonResponse({ error: "账号或密码错误。" }, 401);
  }

  await env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
    .bind(Date.now(), user.id)
    .run();

  return createSessionResponse(env, request, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    credits: Number(user.credits || 0)
  });
}

async function handleLogout(request, env) {
  const sessionCookieName = getSessionCookieName(env);
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[sessionCookieName];

  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await sha256Hex(token))
      .run();
  }

  return jsonResponse(
    { success: true },
    200,
    {
      "Set-Cookie": buildExpiredSessionCookie(sessionCookieName)
    }
  );
}

async function handleSession(request, env) {
  const session = await getSessionFromRequest(request, env);
  if (!session) {
    return jsonResponse({ authenticated: false, user: null });
  }

  return jsonResponse({
    authenticated: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      credits: session.user.credits
    }
  });
}

async function handleLeadSubmission(request, env) {
  const payload = await readJson(request);
  const source = ["index", "enterprise"].includes(payload?.source) ? payload.source : "index";
  const name = sanitizeText(payload?.name, 80);
  const company = sanitizeText(payload?.company, 120);
  const contact = sanitizeText(payload?.contact, 120);
  const note = sanitizeText(payload?.note, 300);

  if (!name && !company && !contact && !note) {
    return jsonResponse({ error: "请至少留下一个联系方式或备注。" }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO sales_leads (id, source, name, company, contact, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(randomId("lead"), source, name, company, contact, note, Date.now())
    .run();

  return jsonResponse({ success: true });
}

async function handleUploadSubmission(request, env) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "上传请求格式不正确。" }, 400);
  }

  const fileEntries = formData.getAll("files").filter((entry) => entry instanceof File);
  if (fileEntries.length === 0) {
    return jsonResponse({ error: "请至少选择 1 张照片。" }, 400);
  }

  if (fileEntries.length > 5) {
    return jsonResponse({ error: "单次最多上传 5 张照片。" }, 400);
  }

  const uploads = [];
  for (const file of fileEntries) {
    const validationError = validateUploadFile(file);
    if (validationError) {
      return jsonResponse({ error: validationError }, 400);
    }

    const uploadId = randomId("upl");
    const objectKey = `${session.user.id}/${uploadId}/${sanitizeFileName(file.name)}`;

    await env.UPLOADS.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream"
      }
    });

    await env.DB.prepare(
      `INSERT INTO uploads (id, user_id, object_key, file_name, mime_type, size_bytes, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(uploadId, session.user.id, objectKey, file.name, file.type || "application/octet-stream", file.size, Date.now(), "uploaded")
      .run();

    uploads.push({
      id: uploadId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      status: "success",
      previewUrl: `/media/uploads/${uploadId}`
    });
  }

  return jsonResponse({
    success: true,
    uploads
  });
}

async function handleJobCreation(request, env, ctx) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const payload = await readJson(request);
  const uploadIds = Array.isArray(payload?.uploadIds)
    ? payload.uploadIds.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const styleSummary = sanitizeText(payload?.styleSummary, 240) || "求职简历场景 / 亲和专业 / 智能背景";
  const packageTier = sanitizeText(payload?.packageTier, 40) || "基础版";
  const amountCents = Number(payload?.amountCents || 990);
  const generationCostCredits = getGenerationCostCredits(env);
  const generationMode = resolveGenerationMode(env);

  if (uploadIds.length < 1 || uploadIds.length > 5) {
    return jsonResponse({ error: "请先上传 1 到 5 张照片。" }, 400);
  }

  if (generationMode.requiresExternalProvider && !generationMode.ready) {
    return jsonResponse(
      {
        error: "图像生成服务尚未配置，暂时不能创建正式生成任务。",
        requiredConfig: generationMode.requiredConfig,
        nextStep: "请配置图像生成服务 API Key 与模型参数后重试。"
      },
      503
    );
  }

  const placeholders = uploadIds.map(() => "?").join(", ");
  const statement = env.DB.prepare(
    `SELECT id, user_id FROM uploads
     WHERE user_id = ? AND id IN (${placeholders})`
  ).bind(session.user.id, ...uploadIds);
  const { results } = await statement.all();

  if ((results || []).length !== uploadIds.length) {
    return jsonResponse({ error: "上传文件无效，请重新上传后再试。" }, 400);
  }

  const debitResult = await env.DB.prepare(
    "UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?"
  )
    .bind(generationCostCredits, session.user.id, generationCostCredits)
    .run();

  if (!debitResult.meta || debitResult.meta.changes !== 1) {
    const user = await env.DB.prepare("SELECT credits FROM users WHERE id = ?")
      .bind(session.user.id)
      .first();
    return jsonResponse(
      {
        error: `积分不足。本次生成需要 ${generationCostCredits} 积分，当前剩余 ${Number(user?.credits || 0)} 积分。`
      },
      402
    );
  }

  const now = Date.now();
  const previewReadyAt = now + 18000;
  const jobId = randomId("job");

  try {
    await env.DB.prepare(
      `INSERT INTO jobs (
        id, user_id, style_summary, package_tier, amount_cents, status,
        result_count, created_at, updated_at, preview_ready_at, unlocked_at,
        charged_at, generation_cost_credits, free_regenerations_remaining
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        jobId,
        session.user.id,
        styleSummary,
        packageTier,
        amountCents,
        "processing",
        DEFAULT_RESULT_COUNT,
        now,
        now,
        previewReadyAt,
        null,
        now,
        generationCostCredits,
        DEFAULT_FREE_REGENERATIONS
      )
      .run();

    let order = 0;
    for (const uploadId of uploadIds) {
      await env.DB.prepare(
        `INSERT INTO job_uploads (job_id, upload_id, sort_order)
         VALUES (?, ?, ?)`
      )
        .bind(jobId, uploadId, order)
        .run();
      order += 1;
    }

    await createInitialJobResults(env, {
      jobId,
      uploadIds,
      mode: generationMode
    });

    if (generationMode.ready) {
      const task = processJobGeneration(env, jobId);
      if (ctx?.waitUntil) {
        ctx.waitUntil(task);
      } else {
        await task;
      }
    }
  } catch (error) {
    await env.DB.prepare("UPDATE users SET credits = credits + ? WHERE id = ?")
      .bind(generationCostCredits, session.user.id)
      .run();
    throw error;
  }

  return jsonResponse({
    success: true,
    jobId,
    chargedCredits: generationCostCredits
  });
}

async function handleJobList(request, env) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const { results } = await env.DB.prepare(
    `SELECT
        jobs.id,
        jobs.style_summary,
        jobs.package_tier,
        jobs.amount_cents,
        jobs.result_count,
        jobs.created_at,
        jobs.updated_at,
        jobs.preview_ready_at,
        jobs.unlocked_at,
        jobs.charged_at,
        jobs.generation_cost_credits,
        jobs.free_regenerations_remaining,
        uploads.id AS cover_upload_id
      FROM jobs
      LEFT JOIN job_uploads
        ON job_uploads.job_id = jobs.id
       AND job_uploads.sort_order = 0
      LEFT JOIN uploads
        ON uploads.id = job_uploads.upload_id
      WHERE jobs.user_id = ?
      ORDER BY jobs.created_at DESC`
  )
    .bind(session.user.id)
    .all();

  const jobs = (results || []).map((job) => ({
    id: job.id,
    styleSummary: job.style_summary,
    packageTier: job.package_tier,
    amountCents: job.amount_cents,
    resultCount: job.result_count,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    chargedAt: job.charged_at,
    generationCostCredits: Number(job.generation_cost_credits || DEFAULT_GENERATION_COST_CREDITS),
    freeRegenerationsRemaining: Number(job.free_regenerations_remaining || 0),
    status: deriveJobStatus(job),
    coverImageUrl: job.cover_upload_id ? `/media/uploads/${job.cover_upload_id}` : null
  }));

  return jsonResponse({ jobs });
}

async function handleJobDetail(request, env, pathname) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const jobId = pathname.replace("/api/jobs/", "");
  const job = await env.DB.prepare(
    `SELECT id, user_id, style_summary, package_tier, amount_cents, result_count,
            created_at, updated_at, preview_ready_at, unlocked_at, charged_at,
            generation_cost_credits, free_regenerations_remaining
     FROM jobs
     WHERE id = ?`
  )
    .bind(jobId)
    .first();

  if (!job || job.user_id !== session.user.id) {
    return jsonResponse({ error: "任务不存在。" }, 404);
  }

  const { results } = await env.DB.prepare(
    `SELECT uploads.id, uploads.file_name, uploads.mime_type, uploads.created_at
     FROM job_uploads
     JOIN uploads ON uploads.id = job_uploads.upload_id
     WHERE job_uploads.job_id = ?
     ORDER BY job_uploads.sort_order ASC`
  )
    .bind(jobId)
    .all();

  const uploads = (results || []).map((upload) => ({
    id: upload.id,
    fileName: upload.file_name,
    mimeType: upload.mime_type,
    previewUrl: `/media/uploads/${upload.id}`
  }));
  const resultItems = await loadJobResultItems(env, job.id, uploads);

  return jsonResponse({
    job: {
      id: job.id,
      styleSummary: job.style_summary,
      packageTier: job.package_tier,
      amountCents: job.amount_cents,
      resultCount: job.result_count,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      previewReadyAt: job.preview_ready_at,
      chargedAt: job.charged_at,
      generationCostCredits: Number(job.generation_cost_credits || DEFAULT_GENERATION_COST_CREDITS),
      freeRegenerationsRemaining: Number(job.free_regenerations_remaining || 0),
      secondsRemaining: Math.max(0, Math.ceil((job.preview_ready_at - Date.now()) / 1000)),
      status: deriveJobStatus(job),
      unlocked: Boolean(job.unlocked_at),
      uploads,
      generation: buildGenerationDisclosure(env),
      results: resultItems
    }
  });
}

async function handleUnlockJob(request, env, pathname) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const jobId = pathname.replace("/api/jobs/", "").replace("/unlock", "");
  const job = await env.DB.prepare("SELECT id, user_id FROM jobs WHERE id = ?")
    .bind(jobId)
    .first();

  if (!job || job.user_id !== session.user.id) {
    return jsonResponse({ error: "任务不存在。" }, 404);
  }

  await env.DB.prepare("UPDATE jobs SET unlocked_at = ?, updated_at = ? WHERE id = ?")
    .bind(Date.now(), Date.now(), jobId)
    .run();

  return jsonResponse({ success: true });
}

async function handleRegenerateJob(request, env, pathname) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const jobId = pathname.replace("/api/jobs/", "").replace("/regenerate", "");
  const job = await env.DB.prepare(
    "SELECT id, user_id, free_regenerations_remaining FROM jobs WHERE id = ?"
  )
    .bind(jobId)
    .first();

  if (!job || job.user_id !== session.user.id) {
    return jsonResponse({ error: "任务不存在。" }, 404);
  }

  if (Number(job.free_regenerations_remaining || 0) <= 0) {
    return jsonResponse({ error: "免费重绘次数已用完。请重新创建生成任务并扣除积分。" }, 402);
  }

  const now = Date.now();
  await env.DB.prepare(
    `UPDATE jobs
     SET unlocked_at = NULL,
         free_regenerations_remaining = free_regenerations_remaining - 1,
         updated_at = ?,
         preview_ready_at = ?
     WHERE id = ? AND free_regenerations_remaining > 0`
  )
    .bind(now, now + 18000, jobId)
    .run();

  await env.DB.prepare("DELETE FROM job_results WHERE job_id = ?")
    .bind(jobId)
    .run();

  const { results } = await env.DB.prepare(
    `SELECT upload_id
     FROM job_uploads
     WHERE job_id = ?
     ORDER BY sort_order ASC`
  )
    .bind(jobId)
    .all();

  await createInitialJobResults(env, {
    jobId,
    uploadIds: (results || []).map((row) => row.upload_id),
    mode: resolveGenerationMode(env)
  });

  return jsonResponse({
    success: true,
    freeRegenerationsRemaining: Number(job.free_regenerations_remaining || 0) - 1
  });
}

async function handleResultDownload(request, env, pathname, url) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const match = pathname.match(/^\/api\/jobs\/([^/]+)\/results\/([^/]+)\/download$/);
  if (!match) {
    return jsonResponse({ error: "下载地址不正确。" }, 400);
  }

  const [, jobId, resultId] = match;
  const variant = sanitizeText(url.searchParams.get("variant") || "jpg", 40);
  if (!["jpg", "original"].includes(variant)) {
    return jsonResponse(
      {
        error: "该导出格式尚未接入。",
        code: "EXPORT_PROVIDER_REQUIRED",
        requiredConfig: variant === "background" ? ["BACKGROUND_REMOVAL_PROVIDER"] : ["MOTION_EXPORT_PROVIDER"],
        nextStep: "请接入对应的图像处理服务后启用此格式。"
      },
      501
    );
  }

  const result = await env.DB.prepare(
    `SELECT
       job_results.id,
       job_results.job_id,
       job_results.label,
       job_results.object_key,
       job_results.mime_type,
       job_results.file_name,
       job_results.source_upload_id,
       jobs.user_id
     FROM job_results
     JOIN jobs ON jobs.id = job_results.job_id
     WHERE job_results.id = ?
       AND job_results.job_id = ?`
  )
    .bind(resultId, jobId)
    .first();

  if (!result || (result.user_id !== session.user.id && session.user.role !== "admin")) {
    return jsonResponse({ error: "结果不存在或无权下载。" }, 404);
  }

  let object = null;
  let fileName = result.file_name || `${result.label || "auralis-result"}.jpg`;
  let mimeType = result.mime_type || "image/jpeg";

  if (result.object_key) {
    object = await env.UPLOADS.get(result.object_key);
  } else if (result.source_upload_id) {
    const source = await env.DB.prepare(
      `SELECT object_key, file_name, mime_type
       FROM uploads
       WHERE id = ?`
    )
      .bind(result.source_upload_id)
      .first();

    if (source) {
      object = await env.UPLOADS.get(source.object_key);
      fileName = source.file_name || fileName;
      mimeType = source.mime_type || mimeType;
    }
  }

  if (!object) {
    return jsonResponse({ error: "结果文件不存在，请重新生成或联系人工支持。" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", mimeType || headers.get("Content-Type") || "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename="${encodeRFC5987(fileName)}"`);
  headers.set("Cache-Control", "private, max-age=60");

  return new Response(object.body, {
    status: 200,
    headers
  });
}

async function handleJobArchiveDownload(request, env, pathname, url) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const jobId = pathname.replace("/api/jobs/", "").replace("/download", "");
  const format = sanitizeText(url.searchParams.get("format") || "zip", 20);
  const job = await env.DB.prepare("SELECT id, user_id FROM jobs WHERE id = ?")
    .bind(jobId)
    .first();

  if (!job || (job.user_id !== session.user.id && session.user.role !== "admin")) {
    return jsonResponse({ error: "任务不存在或无权下载。" }, 404);
  }

  if (format !== "zip") {
    return jsonResponse({ error: "暂不支持该打包格式。" }, 400);
  }

  return jsonResponse(
    {
      error: "批量 ZIP 打包服务尚未接入。",
      code: "ZIP_EXPORT_PROVIDER_REQUIRED",
      requiredConfig: ["ZIP_EXPORT_WORKER_OR_QUEUE"],
      nextStep: "需要接入打包 Worker、队列或对象存储临时文件后启用。"
    },
    501
  );
}

async function handleWeChatPrepay(request, env) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const payload = await readJson(request);
  const credits = normalisePositiveInteger(payload?.credits, DEFAULT_TOP_UP_CREDITS, 100, 100000);
  const amountCents = normalisePositiveInteger(payload?.amountCents, DEFAULT_TOP_UP_AMOUNT_CENTS, 100, 10000000);
  if (!isWeChatPayConfigured(env) && isProductionRuntime(env)) {
    return jsonResponse(
      {
        error: "微信支付生产参数尚未配置，不能创建支付订单。",
        requiredConfig: [
          "WECHATPAY_APP_ID",
          "WECHATPAY_MCH_ID",
          "WECHATPAY_API_V3_KEY",
          "WECHATPAY_PRIVATE_KEY",
          "WECHATPAY_CERT_SERIAL_NO",
          "WECHATPAY_NOTIFY_URL"
        ],
        nextStep: "请配置微信商户参数后再启用线上充值。"
      },
      503
    );
  }

  const orderId = randomId("pay");
  const outTradeNo = `${orderId}_${Date.now()}`;
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO payment_orders
       (id, user_id, provider, status, amount_cents, credits, out_trade_no, code_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(orderId, session.user.id, "wechat_native", "pending", amountCents, credits, outTradeNo, "", now, now)
    .run();

  let payment = null;
  if (isWeChatPayConfigured(env)) {
    payment = await createWeChatNativePrepay(env, {
      outTradeNo,
      amountCents,
      description: `${env.PUBLIC_SITE_NAME || env.APP_NAME || "Auralis"} ${credits}积分充值`,
      notifyUrl: env.WECHATPAY_NOTIFY_URL || `${new URL(request.url).origin}/api/payments/wechat/notify`
    });

    await env.DB.prepare("UPDATE payment_orders SET code_url = ?, raw_response = ?, updated_at = ? WHERE id = ?")
      .bind(payment.codeUrl || "", JSON.stringify(payment.raw || {}), Date.now(), orderId)
      .run();
  } else {
    payment = {
      codeUrl: `weixin://wxpay/mock/${encodeURIComponent(orderId)}`,
      raw: { mode: "mock", reason: "WECHATPAY_* env vars are not configured" }
    };

    await env.DB.prepare("UPDATE payment_orders SET code_url = ?, raw_response = ?, updated_at = ? WHERE id = ?")
      .bind(payment.codeUrl, JSON.stringify(payment.raw), Date.now(), orderId)
      .run();
  }

  return jsonResponse({
    orderId,
    provider: "wechat_native",
    status: "pending",
    amountCents,
    credits,
    codeUrl: payment.codeUrl,
    mock: !isWeChatPayConfigured(env),
    message: isWeChatPayConfigured(env)
      ? "微信支付订单已创建，请扫码支付。"
      : "本地未配置微信支付商户密钥，当前使用模拟支付完成产品流程。"
  });
}

async function handlePaymentStatus(request, env, pathname) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  const orderId = pathname.replace("/api/payments/", "");
  const order = await env.DB.prepare(
    `SELECT id, user_id, status, amount_cents, credits, code_url, paid_at, created_at
     FROM payment_orders
     WHERE id = ?`
  )
    .bind(orderId)
    .first();

  if (!order || (order.user_id !== session.user.id && session.user.role !== "admin")) {
    return jsonResponse({ error: "支付订单不存在。" }, 404);
  }

  return jsonResponse({
    order: {
      id: order.id,
      status: order.status,
      amountCents: Number(order.amount_cents || 0),
      credits: Number(order.credits || 0),
      codeUrl: order.code_url,
      paidAt: order.paid_at,
      createdAt: order.created_at
    }
  });
}

async function handleMockPaymentConfirm(request, env) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  if (isWeChatPayConfigured(env) && env.ENABLE_PAYMENT_MOCK !== "true") {
    return jsonResponse({ error: "生产支付配置已启用，不能使用模拟支付确认。" }, 403);
  }

  if (isProductionRuntime(env) && env.ENABLE_PAYMENT_MOCK !== "true") {
    return jsonResponse({ error: "生产环境不能使用模拟支付确认。" }, 403);
  }

  const payload = await readJson(request);
  const orderId = sanitizeText(payload?.orderId, 80);
  if (!orderId) {
    return jsonResponse({ error: "缺少支付订单号。" }, 400);
  }

  const result = await markPaymentOrderPaid(env, orderId, session.user.id);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, result.status || 400);
  }

  return jsonResponse({
    success: true,
    order: result.order,
    user: result.user
  });
}

async function handleWeChatPaymentNotify(request, env) {
  const payload = await readJson(request);
  if (!isWeChatPayConfigured(env)) {
    return jsonResponse({ code: "SUCCESS", message: "local mock mode" });
  }

  const transaction = await decryptWeChatNotifyResource(env, payload?.resource);
  const outTradeNo = sanitizeText(transaction?.out_trade_no, 120);
  const tradeState = sanitizeText(transaction?.trade_state, 40);

  if (!outTradeNo || tradeState !== "SUCCESS") {
    return jsonResponse({ code: "SUCCESS", message: "notify accepted" });
  }

  const order = await env.DB.prepare("SELECT id FROM payment_orders WHERE out_trade_no = ?")
    .bind(outTradeNo)
    .first();
  if (order) {
    await markPaymentOrderPaid(env, order.id);
  }

  return jsonResponse({ code: "SUCCESS", message: "成功" });
}

async function handleChatMessageSend(request, env) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }
  const payload = await readJson(request);
  const content = sanitizeText(payload?.content, 500);
  const incomingUserId = sanitizeText(payload?.userId, 120);
  const isAdmin = payload?.isAdmin ? 1 : 0;

  if (!content) {
    return jsonResponse({ error: "消息不能为空。" }, 400);
  }

  const userId = session.user.role === "admin" && incomingUserId ? incomingUserId : session.user.id;
  const effectiveAdminFlag = session.user.role === "admin" && isAdmin ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO chat_messages (id, user_id, is_admin, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(randomId("msg"), userId, effectiveAdminFlag, content, Date.now())
    .run();

  return jsonResponse({ success: true });
}

async function handleChatMessages(request, env, url) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }
  const requestedUserId = sanitizeText(url.searchParams.get("userId"), 120);
  const userId =
    session.user.role === "admin"
      ? requestedUserId || session.user.id
      : session.user.id;

  if (!userId) {
    return jsonResponse({ messages: [] });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, is_admin, content, created_at
     FROM chat_messages
     WHERE user_id = ?
     ORDER BY created_at ASC`
  )
    .bind(userId)
    .all();

  return jsonResponse({
    messages: (results || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      isAdmin: Boolean(row.is_admin),
      content: row.content,
      timestamp: row.created_at
    }))
  });
}

async function handleChatUsers(request, env) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  if (session.user.role !== "admin") {
    return jsonResponse({ error: "无权访问。" }, 403);
  }

  const { results } = await env.DB.prepare(
    `SELECT
       chat_messages.user_id,
       users.name,
       users.email,
       MAX(chat_messages.created_at) AS last_message_at,
       SUM(CASE WHEN chat_messages.is_admin = 0 THEN 1 ELSE 0 END) AS customer_message_count
     FROM chat_messages
     LEFT JOIN users ON users.id = chat_messages.user_id
     GROUP BY chat_messages.user_id, users.name, users.email
     ORDER BY last_message_at DESC`
  ).all();

  return jsonResponse({
    users: (results || []).map((row) => ({
      id: row.user_id,
      name: row.name || "访客用户",
      email: row.email || "",
      lastMessageAt: row.last_message_at,
      customerMessageCount: Number(row.customer_message_count || 0)
    }))
  });
}

async function handleAdminSummary(request, env) {
  const session = await requireSession(request, env);
  if (!session.ok) {
    return session.response;
  }

  if (session.user.role !== "admin") {
    return jsonResponse({ error: "无权访问。" }, 403);
  }

  const [usersResponse, jobsResponse] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, email, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 200`
    ).all(),
    env.DB.prepare(
      `SELECT id, created_at, unlocked_at, result_count, package_tier
       FROM jobs
       ORDER BY created_at DESC
       LIMIT 200`
    ).all()
  ]);

  const users = usersResponse.results || [];
  const jobs = jobsResponse.results || [];
  const unlockedJobs = jobs.filter((job) => job.unlocked_at);

  return jsonResponse({
    metrics: {
      users: users.length,
      images: jobs.reduce((sum, job) => sum + Number(job.result_count || 0), 0),
      revenue: (unlockedJobs.length * 9.9).toFixed(1)
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      createdAt: job.created_at,
      resultCount: job.result_count,
      packageTier: job.package_tier,
      unlocked: Boolean(job.unlocked_at)
    }))
  });
}

async function getSessionFromRequest(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[getSessionCookieName(env)];

  if (!token) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const session = await env.DB.prepare(
    `SELECT
        sessions.id AS session_id,
        sessions.expires_at,
        users.id,
        users.name,
        users.email,
        users.role,
        users.credits
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
        AND sessions.expires_at > ?`
  )
    .bind(tokenHash, now)
    .first();

  if (!session) {
    return null;
  }

  return {
    id: session.session_id,
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
      credits: Number(session.credits || 0)
    }
  };
}

async function requireSession(request, env) {
  const session = await getSessionFromRequest(request, env);
  if (!session) {
    return {
      ok: false,
      response: jsonResponse({ error: "请先登录后继续操作。" }, 401)
    };
  }

  return {
    ok: true,
    user: session.user
  };
}

async function createSessionResponse(env, request, user) {
  const sessionId = randomId("ses");
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_SECONDS * 1000;

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      sessionId,
      user.id,
      tokenHash,
      now,
      expiresAt,
      sanitizeText(request.headers.get("User-Agent"), 200),
      sanitizeText(request.headers.get("CF-Connecting-IP"), 120)
    )
    .run();

  return jsonResponse(
    {
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        credits: Number(user.credits || 0)
      }
    },
    200,
    {
      "Set-Cookie": buildSessionCookie(getSessionCookieName(env), token)
    }
  );
}

async function ensureBillingSchema(env) {
  if (billingSchemaReady || !env.DB) {
    return;
  }

  const statements = [
    `ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT ${DEFAULT_INITIAL_CREDITS}`,
    "ALTER TABLE jobs ADD COLUMN charged_at INTEGER",
    `ALTER TABLE jobs ADD COLUMN generation_cost_credits INTEGER NOT NULL DEFAULT ${DEFAULT_GENERATION_COST_CREDITS}`,
    `ALTER TABLE jobs ADD COLUMN free_regenerations_remaining INTEGER NOT NULL DEFAULT ${DEFAULT_FREE_REGENERATIONS}`,
    `CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      credits INTEGER NOT NULL,
      out_trade_no TEXT NOT NULL UNIQUE,
      code_url TEXT,
      transaction_id TEXT,
      raw_response TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      paid_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    "CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_payment_orders_out_trade_no ON payment_orders(out_trade_no)",
    `CREATE TABLE IF NOT EXISTS job_results (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      label TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      object_key TEXT,
      source_upload_id TEXT,
      image_url TEXT,
      mime_type TEXT,
      file_name TEXT,
      quality_score INTEGER,
      diagnostic_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (source_upload_id) REFERENCES uploads(id) ON DELETE SET NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_job_results_job_id ON job_results(job_id, created_at)"
  ];

  for (const sql of statements) {
    try {
      await env.DB.prepare(sql).run();
    } catch (error) {
      const message = String(error?.message || error);
      if (!message.includes("duplicate column name")) {
        throw error;
      }
    }
  }

  await env.DB.prepare(
    `UPDATE jobs
     SET charged_at = COALESCE(charged_at, created_at),
         generation_cost_credits = COALESCE(generation_cost_credits, ?),
         free_regenerations_remaining = COALESCE(free_regenerations_remaining, ?)`
  )
    .bind(DEFAULT_GENERATION_COST_CREDITS, DEFAULT_FREE_REGENERATIONS)
    .run();

  billingSchemaReady = true;
}

function getGenerationCostCredits(env) {
  const configuredValue = Number(env.GENERATION_COST_CREDITS);
  return Number.isFinite(configuredValue) && configuredValue > 0
    ? Math.floor(configuredValue)
    : DEFAULT_GENERATION_COST_CREDITS;
}

function normalisePositiveInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function isWeChatPayConfigured(env) {
  return Boolean(
    env.WECHATPAY_APP_ID &&
      env.WECHATPAY_MCH_ID &&
      env.WECHATPAY_API_V3_KEY &&
      env.WECHATPAY_PRIVATE_KEY &&
      env.WECHATPAY_CERT_SERIAL_NO
  );
}

async function decryptWeChatNotifyResource(env, resource) {
  if (!resource?.ciphertext || !resource?.nonce) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.WECHATPAY_API_V3_KEY),
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const additionalData = resource.associated_data ? encoder.encode(resource.associated_data) : undefined;
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: encoder.encode(resource.nonce),
      additionalData
    },
    key,
    base64ToArrayBuffer(resource.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function createWeChatNativePrepay(env, order) {
  const body = {
    appid: env.WECHATPAY_APP_ID,
    mchid: env.WECHATPAY_MCH_ID,
    description: order.description,
    out_trade_no: order.outTradeNo,
    notify_url: order.notifyUrl,
    amount: {
      total: order.amountCents,
      currency: "CNY"
    }
  };
  const url = "https://api.mch.weixin.qq.com/v3/pay/transactions/native";
  const bodyText = JSON.stringify(body);
  const authorization = await buildWeChatAuthorizationHeader(env, "POST", "/v3/pay/transactions/native", bodyText);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": env.APP_NAME || "Auralis"
    },
    body: bodyText
  });
  const responseText = await response.text();
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch (_error) {
    payload = { raw: responseText };
  }

  if (!response.ok || !payload.code_url) {
    console.error("WeChat Pay prepay failed", response.status, payload);
    throw new Error("微信支付下单失败，请检查商户参数与证书配置。");
  }

  return {
    codeUrl: payload.code_url,
    raw: payload
  };
}

async function buildWeChatAuthorizationHeader(env, method, canonicalUrl, bodyText) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomHex(16);
  const message = `${method}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${bodyText}\n`;
  const signature = await signWechatMessage(env.WECHATPAY_PRIVATE_KEY, message);
  const params = [
    `mchid="${env.WECHATPAY_MCH_ID}"`,
    `nonce_str="${nonce}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${env.WECHATPAY_CERT_SERIAL_NO}"`,
    `signature="${signature}"`
  ];
  return `WECHATPAY2-SHA256-RSA2048 ${params.join(",")}`;
}

async function signWechatMessage(privateKeyPem, message) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(message));
  return arrayBufferToBase64(signature);
}

function pemToArrayBuffer(pem) {
  const base64 = String(pem)
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function base64ToUint8Array(base64) {
  return new Uint8Array(base64ToArrayBuffer(base64));
}

async function markPaymentOrderPaid(env, orderId, expectedUserId) {
  const order = await env.DB.prepare(
    `SELECT id, user_id, status, amount_cents, credits
     FROM payment_orders
     WHERE id = ?`
  )
    .bind(orderId)
    .first();

  if (!order) {
    return { ok: false, status: 404, error: "支付订单不存在。" };
  }

  if (expectedUserId && order.user_id !== expectedUserId) {
    return { ok: false, status: 403, error: "无权确认该支付订单。" };
  }

  if (order.status !== "paid") {
    const now = Date.now();
    await env.DB.prepare("UPDATE payment_orders SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, order.id)
      .run();
    await env.DB.prepare("UPDATE users SET credits = credits + ? WHERE id = ?")
      .bind(Number(order.credits || 0), order.user_id)
      .run();
  }

  const user = await env.DB.prepare("SELECT id, name, email, role, credits FROM users WHERE id = ?")
    .bind(order.user_id)
    .first();

  return {
    ok: true,
    order: {
      id: order.id,
      status: "paid",
      amountCents: Number(order.amount_cents || 0),
      credits: Number(order.credits || 0)
    },
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          credits: Number(user.credits || 0)
        }
      : null
  };
}

function buildRobotsResponse(url) {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /login.html",
    "Disallow: /upload.html",
    "Disallow: /style.html",
    "Disallow: /checkout.html",
    "Disallow: /generating.html",
    "Disallow: /result.html",
    "Disallow: /dashboard.html",
    "Disallow: /dashboard_assets.html",
    "Disallow: /dashboard_settings.html",
    "Disallow: /dashboard_privacy.html",
    "Disallow: /admin.html",
    `Sitemap: ${url.origin}/sitemap.xml`
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function buildSitemapResponse(url) {
  const now = new Date().toISOString();
  const urls = PUBLIC_SITEMAP_PATHS.map((path) => {
    const loc = `${url.origin}${path === "/" ? "" : path}`;
    return `<url><loc>${escapeXml(loc)}</loc><lastmod>${now}</lastmod></url>`;
  }).join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8"
      }
    }
  );
}

function withHeaders(response, request) {
  const headers = new Headers(response.headers);
  const contentType = headers.get("Content-Type") || "";
  const url = new URL(request.url);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests"
    ].join("; ")
  );

  if (contentType.includes("text/html")) {
    headers.set("Link", `<${url.toString()}>; rel="canonical"`);
    headers.set("X-Robots-Tag", isPrivatePage(url.pathname) ? "noindex, nofollow" : "index, follow");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function createInitialJobResults(env, { jobId, uploadIds, mode }) {
  const now = Date.now();
  const sourceUploadIds = uploadIds.length > 0 ? uploadIds : [null];
  const provider = mode.ready ? mode.provider : "local_reference";
  const status = mode.ready ? "queued" : "reference_only";
  const diagnosticMessage = mode.ready
    ? "已进入图像生成队列，等待生成服务回写结果。"
    : "当前环境未配置图像生成服务，先展示可下载的原始上传参考图。";

  for (let index = 0; index < DEFAULT_RESULT_COUNT; index += 1) {
    const sourceUploadId = sourceUploadIds[index % sourceUploadIds.length];
    await env.DB.prepare(
      `INSERT INTO job_results (
        id, job_id, label, provider, status, object_key, source_upload_id,
        image_url, mime_type, file_name, quality_score, diagnostic_message,
        created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        `${jobId}_res_${index + 1}`,
        jobId,
        RESULT_LABELS[index % RESULT_LABELS.length],
        provider,
        status,
        null,
        sourceUploadId,
        null,
        "image/jpeg",
        `${jobId}_${index + 1}.jpg`,
        mode.ready ? null : 0,
        diagnosticMessage,
        now,
        now
      )
      .run();
  }
}

async function loadJobResultItems(env, jobId, uploads) {
  const { results } = await env.DB.prepare(
    `SELECT id, label, provider, status, object_key, source_upload_id, image_url,
            mime_type, file_name, quality_score, diagnostic_message, created_at, updated_at
     FROM job_results
     WHERE job_id = ?
     ORDER BY created_at ASC, id ASC`
  )
    .bind(jobId)
    .all();

  if (!results || results.length === 0) {
    return buildLegacyResultItems(jobId, uploads);
  }

  const uploadMap = new Map(uploads.map((upload) => [upload.id, upload]));
  return results.map((result) => {
    const sourceUpload = uploadMap.get(result.source_upload_id);
    const imageUrl = result.image_url || (result.object_key ? `/api/jobs/${jobId}/results/${result.id}/download` : sourceUpload?.previewUrl || null);
    const canDownload = Boolean(result.object_key || result.source_upload_id);

    return {
      id: result.id,
      label: result.label,
      provider: result.provider,
      status: result.status,
      imageUrl,
      sourceImageUrl: sourceUpload?.previewUrl || null,
      qualityScore: result.quality_score,
      message: result.diagnostic_message,
      referenceOnly: result.status === "reference_only",
      canDownload,
      downloadUrl: canDownload ? `/api/jobs/${jobId}/results/${result.id}/download?variant=jpg` : null,
      exportUrls: {
        jpg: canDownload ? `/api/jobs/${jobId}/results/${result.id}/download?variant=jpg` : null,
        background: `/api/jobs/${jobId}/results/${result.id}/download?variant=background`,
        motion: `/api/jobs/${jobId}/results/${result.id}/download?variant=motion`
      }
    };
  });
}

async function processJobGeneration(env, jobId) {
  const job = await env.DB.prepare(
    `SELECT id, user_id, style_summary
     FROM jobs
     WHERE id = ?`
  )
    .bind(jobId)
    .first();

  if (!job) {
    return;
  }

  const { results: uploads } = await env.DB.prepare(
    `SELECT uploads.id, uploads.object_key, uploads.mime_type, uploads.file_name
     FROM job_uploads
     JOIN uploads ON uploads.id = job_uploads.upload_id
     WHERE job_uploads.job_id = ?
     ORDER BY job_uploads.sort_order ASC`
  )
    .bind(jobId)
    .all();

  const { results } = await env.DB.prepare(
    `SELECT id, label, source_upload_id
     FROM job_results
     WHERE job_id = ?
     ORDER BY created_at ASC, id ASC`
  )
    .bind(jobId)
    .all();

  if (!uploads?.length || !results?.length) {
    return;
  }

  const mode = resolveGenerationMode(env);

  try {
    await env.DB.prepare("UPDATE job_results SET status = ?, updated_at = ?, diagnostic_message = ? WHERE job_id = ?")
      .bind("generating", Date.now(), "正在调用 Seedream 图生一组图服务。", jobId)
      .run();

    const source = uploads[0];
    const sourceObject = await env.UPLOADS.get(source.object_key);
    if (!sourceObject) {
      throw new Error("源照片文件不存在。");
    }

    const generatedImages = await generateImageSetWithProvider(env, {
      mode,
      sourceBytes: await sourceObject.arrayBuffer(),
      sourceMimeType: source.mime_type || "image/jpeg",
      labels: results.map((result) => result.label),
      styleSummary: job.style_summary
    });

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const generated = generatedImages[index];
      if (!generated) {
        await env.DB.prepare("UPDATE job_results SET status = ?, diagnostic_message = ?, updated_at = ? WHERE id = ?")
          .bind("failed", "图像生成服务返回图片数量不足，请重试。", Date.now(), result.id)
          .run();
        continue;
      }

      const objectKey = `${job.user_id}/${job.id}/${result.id}.${generated.extension}`;
      await env.UPLOADS.put(objectKey, generated.bytes, {
        httpMetadata: {
          contentType: generated.mimeType
        }
      });

      await env.DB.prepare(
        `UPDATE job_results
         SET status = ?, object_key = ?, mime_type = ?, file_name = ?,
             provider = ?, quality_score = ?, diagnostic_message = ?, updated_at = ?
         WHERE id = ?`
      )
        .bind(
          "ready",
          objectKey,
          generated.mimeType,
          `${result.label}.${generated.extension}`,
          mode.provider,
          generated.qualityScore,
          "Seedream 图生一组图完成，已写入私有对象存储。",
          Date.now(),
          result.id
        )
        .run();
    }
  } catch (error) {
    console.error("Image generation failed", jobId, error);
    await env.DB.prepare("UPDATE job_results SET status = ?, diagnostic_message = ?, updated_at = ? WHERE job_id = ?")
      .bind("failed", sanitizeText(error?.message || "图像生成失败。", 300), Date.now(), jobId)
      .run();
  }
}

async function generateImageSetWithProvider(env, input) {
  if (input.mode.provider !== "doubao") {
    throw new Error("当前仅内置豆包/火山方舟图像生成适配器。");
  }

  return generateSeedreamImageSet(env, input);
}

async function generateSeedreamImageSet(env, input) {
  const apiKey = env.DOUBAO_API_KEY || env.ARK_API_KEY;
  const apiUrl = env.DOUBAO_API_URL || `${ARK_IMAGE_BASE_URL}${ARK_IMAGE_GENERATIONS_PATH}`;
  const imageBase64 = arrayBufferToBase64(input.sourceBytes);
  const imageValue = env.DOUBAO_INPUT_IMAGE_FORMAT === "data_url"
    ? `data:${input.sourceMimeType};base64,${imageBase64}`
    : imageBase64;

  const body = {
    model: ARK_SEEDREAM_IMAGE_MODEL,
    prompt: buildHeadshotSetPrompt(input.labels, input.styleSummary),
    size: "2K",
    response_format: "b64_json",
    stream: true,
    image: imageValue,
    watermark: false,
    sequential_image_generation: "auto",
    sequential_image_generation_options: {
      max_images: Math.min(DEFAULT_RESULT_COUNT, Math.max(1, input.labels.length))
    }
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("Seedream generation failed", response.status, responseText.slice(0, 1000));
    throw new Error("图像生成服务返回错误，请检查模型、额度或参数配置。");
  }

  const items = collectGeneratedImageItems(responseText);
  if (items.length === 0) {
    throw new Error("图像生成服务没有返回图片。");
  }

  return Promise.all(items.slice(0, DEFAULT_RESULT_COUNT).map((item) => generatedImageItemToAsset(item)));
}

async function generatedImageItemToAsset(item) {
  if (item.b64_json || item.base64) {
    return {
      bytes: base64ToUint8Array(stripDataUrl(item.b64_json || item.base64)),
      mimeType: "image/png",
      extension: "png",
      qualityScore: 90
    };
  }

  const imageUrl = item.url || item.image_url;
  if (!imageUrl) {
    throw new Error("图像生成服务返回格式缺少图片数据。");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("生成图下载失败。");
  }

  const contentType = imageResponse.headers.get("Content-Type") || "image/jpeg";
  return {
    bytes: await imageResponse.arrayBuffer(),
    mimeType: contentType,
    extension: contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg",
    qualityScore: 88
  };
}

function buildHeadshotSetPrompt(labels, styleSummary) {
  return [
    `基于用户上传的真实自拍，一次生成 ${labels.length} 张职业形象照，分别对应：${labels.join("、")}。`,
    `用户选择与场景摘要：${styleSummary || "求职简历场景 / 亲和专业 / 智能背景"}。`,
    "必须保持人物身份、五官比例、脸型、发际线、发型和年龄观感一致，不换脸，不改变性别，不生成多人。",
    "每张图需要有明显不同的背景、构图、光线和职场氛围，但人物本人必须一致。",
    "摄影标准：真实商业棚拍质感，85mm 人像镜头效果，自然皮肤纹理，眼神清晰，发丝边缘干净，服装合身，背景简洁高级。",
    "输出质量：高清、无水印、无文字、无 Logo、无畸变、无塑料皮肤、不过度磨皮、不过度锐化。"
  ].join(" ");
}

function collectGeneratedImageItems(responseText) {
  const text = String(responseText || "").trim();
  const items = [];

  if (text.includes("data:")) {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }
      try {
        const event = JSON.parse(data);
        if (event?.type === "image_generation.partial_succeeded" && (event.b64_json || event.base64 || event.url || event.image_url)) {
          items.push(event);
        } else {
          items.push(...pickGeneratedImageItems(event));
        }
      } catch (_error) {
        // Ignore malformed keepalive/event lines.
      }
    }
    return items;
  }

  try {
    return pickGeneratedImageItems(JSON.parse(text));
  } catch (_error) {
    return [];
  }
}

function pickGeneratedImageItems(payload) {
  if (Array.isArray(payload?.data) && payload.data.length > 0) {
    return payload.data;
  }
  if (Array.isArray(payload?.images) && payload.images.length > 0) {
    return payload.images;
  }
  if (Array.isArray(payload?.result?.data) && payload.result.data.length > 0) {
    return payload.result.data;
  }
  if (payload?.b64_json || payload?.base64 || payload?.url || payload?.image_url) {
    return [payload];
  }
  return [];
}

function stripDataUrl(value) {
  const text = String(value || "");
  return text.startsWith("data:") && text.includes(",") ? text.split(",", 2)[1] : text;
}

function buildLegacyResultItems(jobId, uploads) {
  const sourceUploads = uploads.length > 0 ? uploads : [{ id: null, previewUrl: null }];
  return Array.from({ length: DEFAULT_RESULT_COUNT }).map((_, index) => {
    const upload = sourceUploads[index % sourceUploads.length];
    return {
      id: `${jobId}_${index + 1}`,
      label: RESULT_LABELS[index % RESULT_LABELS.length],
      provider: "legacy",
      status: "reference_only",
      imageUrl: upload.previewUrl,
      sourceImageUrl: upload.previewUrl,
      qualityScore: 0,
      message: "旧任务没有结果记录，当前按原始上传图做兼容预览。",
      referenceOnly: true,
      canDownload: false,
      downloadUrl: null,
      exportUrls: {}
    };
  });
}

function buildGenerationDisclosure(env) {
  const mode = resolveGenerationMode(env);
  return {
    provider: mode.provider,
    model: ARK_SEEDREAM_IMAGE_MODEL,
    ready: mode.ready,
    referenceOnly: !mode.ready,
    message: mode.ready
      ? `Seedream 图生一组图已配置，固定使用 ${ARK_SEEDREAM_IMAGE_MODEL}。`
      : "当前环境未配置图像生成服务，页面展示的是上传参考图，不会伪装成 AI 成片。",
    requiredConfig: mode.ready ? [] : mode.requiredConfig
  };
}

function resolveGenerationMode(env) {
  const provider = sanitizeText(env.IMAGE_GENERATION_PROVIDER || env.GENERATION_PROVIDER || "doubao", 40).toLowerCase();
  const isDoubaoReady = Boolean(env.DOUBAO_API_KEY || env.ARK_API_KEY);
  const ready = provider === "doubao" ? isDoubaoReady : Boolean(env.IMAGE_GENERATION_API_KEY && env.IMAGE_GENERATION_ENDPOINT);
  const production = isProductionRuntime(env);

  return {
    provider,
    ready,
    requiresExternalProvider: production,
    requiredConfig:
      provider === "doubao"
        ? ["ARK_API_KEY 或 DOUBAO_API_KEY", `固定模型：${ARK_SEEDREAM_IMAGE_MODEL}`, `固定默认地址：${ARK_IMAGE_BASE_URL}`]
        : ["IMAGE_GENERATION_PROVIDER", "IMAGE_GENERATION_API_KEY", "IMAGE_GENERATION_ENDPOINT", "IMAGE_GENERATION_MODEL"]
  };
}

function isProductionRuntime(env) {
  return ["production", "prod"].includes(String(env.ENVIRONMENT || env.NODE_ENV || "").toLowerCase());
}

function deriveJobStatus(job) {
  if (job.unlocked_at) {
    return "unlocked";
  }
  if (Date.now() >= Number(job.preview_ready_at)) {
    return "preview";
  }
  return "processing";
}

function validateUploadFile(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "仅支持 JPG、PNG、WebP、HEIC 等常见图片格式。";
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return "单张照片不能超过 10MB。";
  }

  return null;
}

function validatePassword(password) {
  if (password.length < 8) {
    return "密码至少需要 8 位。";
  }
  if (!/[A-Z]/.test(password)) {
    return "密码需要至少包含 1 个大写字母。";
  }
  if (!/[a-z]/.test(password)) {
    return "密码需要至少包含 1 个小写字母。";
  }
  if (!/[0-9\W_]/.test(password)) {
    return "密码需要包含数字或特殊符号。";
  }
  return null;
}

async function derivePasswordHash(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToUint8Array(saltHex),
      iterations: PASSWORD_ITERATIONS
    },
    key,
    256
  );

  return uint8ArrayToHex(new Uint8Array(bits));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return uint8ArrayToHex(new Uint8Array(digest));
}

function buildSessionCookie(name, token) {
  return [
    `${name}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_DURATION_SECONDS}`
  ].join("; ");
}

function buildExpiredSessionCookie(name) {
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
}

function getSessionCookieName(env) {
  return env.SESSION_COOKIE_NAME || "impeccable_session";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

function methodNotAllowed(allow) {
  return jsonResponse(
    { error: "请求方法不被允许。" },
    405,
    {
      Allow: allow.join(", ")
    }
  );
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return acc;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeText(value, maxLength = 255) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeFileName(fileName) {
  const cleaned = String(fileName || "upload")
    .replace(/[^\w.\-()\u4e00-\u9fa5]/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
  return cleaned || "upload";
}

function randomId(prefix) {
  return `${prefix}_${randomHex(12)}`;
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return uint8ArrayToHex(bytes);
}

function uint8ArrayToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToUint8Array(hex) {
  const pairs = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function trimTrailingSlash(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}

function hasFileExtension(pathname) {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function encodeRFC5987(value) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16)}`);
}

function matchAdminEmail(email, adminList) {
  if (!adminList) {
    return false;
  }

  const emails = String(adminList)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return emails.includes(email);
}

function isPrivatePage(pathname) {
  return PRIVATE_PATH_PREFIXES.some((prefix) => pathname === `${prefix}.html` || pathname.startsWith(`${prefix}_`) || pathname === prefix);
}

const encoder = new TextEncoder();
