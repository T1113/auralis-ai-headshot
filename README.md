# Auralis 曜临 - AI 形象照独立站

<p align="center">
  <img src="banner.png" alt="Auralis Banner" width="800px" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stack-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Database-D1-00ADD8?style=for-the-badge&logo=sqlite&logoColor=white" alt="D1">
  <img src="https://img.shields.io/badge/Storage-R2-FF9900?style=for-the-badge&logo=amazon-s3&logoColor=white" alt="R2">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

---

## 🌟 愿景：让专业形象照触手可及

**Auralis 曜临** 是一款基于顶尖边缘计算技术的 AI 形象照生成系统。我们通过极致的 UX 设计，将复杂的 AI 生成流程简化为“拍照-选择-生成”三步走，为用户提供影棚级的专业肖像体验。

---

## ✨ 核心特性

- **📸 沉浸式相机系统**：深度集成 WebRTC，支持网页端实时取景、前置/后置切换，内置自拍指导建议。
- **🌐 多语言国际化 (i18n)**：支持中文、英语、日语、法语、西班牙语等多语言实时切换，适配全球化业务需求。
- **⚡ 边缘计算架构**：全栈部署于 Cloudflare Workers，全球毫秒级响应，告别昂贵的服务器维护。
- **🛡️ 隐私与安全**：照片存储于加密的 R2 Bucket，处理完成后自动清理，严格保护用户隐私。
- **🎨 精细化风格定制**：内置多种职场风格（金融、科技、时尚等），支持通过 Prompt 细微调整。
- **🤖 自动化质检**：上传阶段自动检测光照、角度与遮挡，确保生成效果的最佳下限。
- **📈 全栈管理后台**：从用户配额管理到生成任务监控，提供完整的一站式运营看板。

---

## 🛠️ 技术深度

| 模块 | 技术实现 |
| :--- | :--- |
| **前端渲染** | 原生 HTML5/CSS3 + Vanilla JS (0 框架依赖，极致 SEO) |
| **逻辑中枢** | Cloudflare Workers (JavaScript/ESM) |
| **数据持久化** | Cloudflare D1 (SQL) |
| **资产管理** | Cloudflare R2 (S3-compatible) |
| **部署流程** | GitHub Actions + Wrangler CLI |

---

## 🚀 快速启动

### 1. 基础环境
```bash
git clone https://github.com/your-username/auralis.git
cd auralis
npm install
```

### 2. 初始化云资源
```bash
# 登录并验证
npx wrangler login

# 创建资源
npx wrangler d1 create impeccable-db
npx wrangler r2 bucket create impeccable-uploads
```
*提示：请将返回的 ID 填入 `wrangler.jsonc`。*

### 3. 一键部署
```bash
npx wrangler d1 migrations apply impeccable-db
npm run deploy
```

---

## 📂 目录导航

- `形象照/`: 纯净的前端代码，包含精心调教的 CSS 变量系统。
- `src/`: 高性能边缘函数逻辑。
- `migrations/`: 结构化的数据库演进记录。
- `docs/`: 包含 API 定义与架构演进文档。

---

## 🤝 贡献与反馈

我们欢迎任何形式的 PR 和 Issue。如果您觉得这个项目有帮助，请给它一个 ⭐️！

---

<p align="center">Made with ❤️ for the AI Community</p>
