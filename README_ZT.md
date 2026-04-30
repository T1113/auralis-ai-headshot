# Auralis 曜臨 - AI 形象照獨立站

<p align="center">
  <img src="banner.png" alt="Auralis Banner" width="800px" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <b>繁體中文</b> | <a href="README_EN.md">English</a> | <a href="README_JA.md">日本語</a> | <a href="README_FR.md">Français</a> | <a href="README_ES.md">Español</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stack-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Database-D1-00ADD8?style=for-the-badge&logo=sqlite&logoColor=white" alt="D1">
  <img src="https://img.shields.io/badge/Storage-R2-FF9900?style=for-the-badge&logo=amazon-s3&logoColor=white" alt="R2">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

---

## 🌟 願景：讓專業形象照觸手可及

**Auralis 曜臨** 是一款基於頂尖邊緣運算技術的 AI 形象照生成系統。我們通過極致的 UX 設計，將複雜的 AI 生成流程簡化為「拍照-選擇-生成」三步走，為用戶提供影棚級的專業肖像體驗。

---

## ✨ 核心特性

- **📸 沉浸式相機系統**：深度集成 WebRTC，支持網頁端實時取景、前置/後置切換，內置自拍指導建議。
- **🌐 多語言國際化 (i18n)**：支持簡體中文、繁體中文、英語、日語、法語、西班牙語等多語言實時切換。
- **⚡ 邊緣運算架構**：全棧部署於 Cloudflare Workers，全球毫秒級響應，告別昂貴的服務器維護。
- **🛡️ 隱私與安全**：照片存儲於加密的 R2 Bucket，處理完成後自動清理，嚴格保護用戶隱私。
- **🎨 精細化風格定制**：內置多種職場風格（金融、科技、時尚等），支持通過 Prompt 細微調整。
- **🤖 自動化質檢**：上傳階段自動檢測光照、角度與遮擋，確保生成效果的最佳下限。
- **📈 全棧管理後台**：從用戶配額管理到生成任務監控，提供完整的一站式運營看板。

---

## 🛠️ 技術深度

| 模組 | 技術實現 |
| :--- | :--- |
| **前端渲染** | 原生 HTML5/CSS3 + Vanilla JS (0 框架依賴，極致 SEO) |
| **邏輯中樞** | Cloudflare Workers (JavaScript/ESM) |
| **數據持久化** | Cloudflare D1 (SQL) |
| **資產管理** | Cloudflare R2 (S3-compatible) |
| **部署流程** | Wrangler CLI / GitHub Actions |

---

## 🚀 快速啟動

### 1. 基礎環境
```bash
git clone https://github.com/T1113/auralis-ai-headshot.git
cd auralis
npm install
```

### 2. 初始化雲資源
```bash
npx wrangler login
npx wrangler d1 create impeccable-db
npx wrangler r2 bucket create impeccable-uploads
```

### 3. 一鍵部署
```bash
npx wrangler d1 migrations apply impeccable-db
npm run deploy
```

---

## 🤝 貢獻與回饋

我們歡迎任何形式的 PR 和 Issue。如果您覺得這個項目有幫助，請給它一個 ⭐️！

---

<p align="center">Made with ❤️ for the AI Community</p>
