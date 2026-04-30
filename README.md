# Auralis 曜临 - AI 形象照独立站

![Auralis Banner](https://raw.githubusercontent.com/username/repo/main/test-headshot.png)

> **极致优雅的 AI 形象照生成系统，支持网页端实时拍照与全栈云原生部署。**

Auralis 曜临是一个专为“AI 形象照”设计的完整独立站解决方案。它不仅提供了精美的前端交互界面，还通过 Cloudflare 生态系统实现了高性能、低成本的全栈部署。

---

## ✨ 核心特性

- **📸 网页端实时相机**：深度集成浏览器摄像头调用，支持前置/后置切换、实时预览、重拍及质量检测。
- **🚀 全栈云原生架构**：基于 Cloudflare Workers + D1 数据库 + R2 存储空间，实现零成本起步的高可用架构。
- **🎨 完整 UX 闭环**：涵盖上传、质量检测、风格选择、生成等待、结果展示的全流程。
- **📊 管理端看板**：内置资产管理、隐私设置、个人资料调整等功能。
- **🔍 极致 SEO 优化**：自动生成的 `robots.txt` 与 `sitemap.xml`，支持搜索引擎收录，营销页与私有页面权限隔离。
- **📱 响应式设计**：完美适配移动端与桌面端，提供原生般的交互体验。

---

## 🛠️ 技术栈

- **Frontend**: Vanilla JS / HTML5 / CSS3 (极致加载速度)
- **Backend**: Cloudflare Workers (Edge Computing)
- **Database**: Cloudflare D1 (Serverless SQL)
- **Storage**: Cloudflare R2 (Object Storage)
- **Deployment**: Wrangler / GitHub Actions

---

## 📦 快速开始

### 1. 克隆并安装
```bash
git clone https://github.com/your-username/auralis.git
cd auralis
npm install
```

### 2. Cloudflare 配置
1. 登录 Cloudflare: `npx wrangler login`
2. 创建数据库: `npx wrangler d1 create impeccable-db`
3. 创建存储桶: `npx wrangler r2 bucket create impeccable-uploads`
4. 修改 `wrangler.jsonc` 中的 `database_id`。

### 3. 部署
```bash
# 执行数据库迁移
npx wrangler d1 migrations apply impeccable-db

# 部署到 Cloudflare
npm run deploy
```

---

## 📂 项目结构

```text
├── 形象照/           # 静态资源与前端页面 (index, upload, dashboard...)
├── src/             # Cloudflare Workers 后端逻辑 (worker.js)
├── migrations/      # D1 数据库迁移脚本
├── wrangler.jsonc    # Cloudflare 配置文件
└── CLOUDFLARE_DEPLOY.md # 详细部署指南
```

---

## 📸 效果展示

*在此处插入你的项目截图*

- **上传页面**: 支持拖拽与本地相册。
- **相机模式**: 网页内实时自拍。
- **生成过程**: 动态进度反馈。

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

**Auralis 曜临** - 让每一个人都能轻松拥有专业的 AI 形象照。
