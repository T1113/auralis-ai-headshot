# Cloudflare 部署说明

## 1. 安装依赖

```bash
npm install
```

## 2. 登录 Cloudflare

```bash
npx wrangler login
npx wrangler whoami
```

## 3. 创建 D1 数据库

```bash
npx wrangler d1 create impeccable-db
```

把终端返回的 `database_id` 填回 [wrangler.jsonc](/Users/chris/Desktop/形象照_副本/wrangler.jsonc:1) 的 `d1_databases[0].database_id`。

## 4. 创建 R2 Bucket

```bash
npx wrangler r2 bucket create impeccable-uploads
```

如果你想换 bucket 名称，也同步更新 [wrangler.jsonc](/Users/chris/Desktop/形象照_副本/wrangler.jsonc:1)。

## 5. 执行数据库迁移

```bash
npx wrangler d1 migrations apply impeccable-db
```

## 6. 可选：设置管理员邮箱

```bash
npx wrangler secret put ADMIN_EMAILS
```

值可以是一个邮箱，也可以是逗号分隔的多个邮箱，例如：

```text
founder@example.com,ops@example.com
```

## 7. 本地预览

```bash
npm run dev
```

## 8. 正式部署

```bash
npm run deploy
```

## 9. 绑定自定义域名

部署成功后，在 Cloudflare Dashboard 的 Worker 设置里绑定你的正式域名。完成后：

- `robots.txt` 会自动指向正式域名的 `sitemap.xml`
- 公开营销页可以被搜索引擎收录
- 登录、上传、控制台等私有页面会自动带 `noindex`
