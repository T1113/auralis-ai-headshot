# Auralis 曜临 - AI Profile Photo Station

<p align="center">
  <img src="banner.png" alt="Auralis Banner" width="800px" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_ZT.md">繁體中文</a> | <b>English</b> | <a href="README_JA.md">日本語</a> | <a href="README_FR.md">Français</a> | <a href="README_ES.md">Español</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stack-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Database-D1-00ADD8?style=for-the-badge&logo=sqlite&logoColor=white" alt="D1">
  <img src="https://img.shields.io/badge/Storage-R2-FF9900?style=for-the-badge&logo=amazon-s3&logoColor=white" alt="R2">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

---

## 🌟 Vision: Professional Portraits for Everyone

**Auralis** is an AI-powered profile photo generation system built on top-tier edge computing. We simplify the complex AI generation process into a seamless "Shoot-Select-Generate" workflow, providing studio-quality portraits for every user.

---

## ✨ Core Features

- **📸 Immersive Camera System**: Deeply integrated WebRTC for real-time preview, front/rear camera switching, and built-in selfie guidance.
- **🌐 Multi-language i18n**: Support for Chinese, English, Japanese, French, and Spanish with real-time switching.
- **⚡ Edge Computing Architecture**: Full-stack deployment on Cloudflare Workers for global millisecond response and zero server maintenance.
- **🛡️ Privacy & Security**: Photos are stored in encrypted R2 Buckets and automatically cleared after processing.
- **🎨 Fine-grained Style Customization**: Built-in professional styles (Finance, Tech, Fashion, etc.) with Prompt-based adjustments.
- **🤖 Automated Quality Check**: Detects lighting, angles, and occlusions during upload to ensure optimal generation quality.
- **📈 Management Dashboard**: Comprehensive monitoring for user quotas and generation tasks.

---

## 🛠️ Technical Stack

| Module | Implementation |
| :--- | :--- |
| **Frontend** | Vanilla HTML5/CSS3 + JS (0 dependencies, optimized for SEO) |
| **Backend** | Cloudflare Workers (JavaScript/ESM) |
| **Database** | Cloudflare D1 (Serverless SQL) |
| **Storage** | Cloudflare R2 (Object Storage) |
| **Deployment** | Wrangler CLI / GitHub Actions |

---

## 🚀 Quick Start

### 1. Prerequisites
```bash
git clone https://github.com/T1113/auralis-ai-headshot.git
cd auralis
npm install
```

### 2. Cloud Resources
```bash
npx wrangler login
npx wrangler d1 create impeccable-db
npx wrangler r2 bucket create impeccable-uploads
```
*Note: Fill the returned IDs into `wrangler.jsonc`.*

### 3. Deploy
```bash
npx wrangler d1 migrations apply impeccable-db
npm run deploy
```

---

## 🤝 Contribution

We welcome PRs and Issues! If you find this project helpful, please give it a ⭐️!

---

<p align="center">Made with ❤️ for the AI Community</p>
