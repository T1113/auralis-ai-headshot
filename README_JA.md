# Auralis 曜临 - AI プロフィール写真ステーション

<p align="center">
  <img src="banner.png" alt="Auralis Banner" width="800px" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_ZT.md">繁體中文</a> | <a href="README_EN.md">English</a> | <b>日本語</b> | <a href="README_FR.md">Français</a> | <a href="README_ES.md">Español</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stack-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Database-D1-00ADD8?style=for-the-badge&logo=sqlite&logoColor=white" alt="D1">
  <img src="https://img.shields.io/badge/Storage-R2-FF9900?style=for-the-badge&logo=amazon-s3&logoColor=white" alt="R2">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

---

## 🌟 ビジョン：プロのポートレートをすべての人に

**Auralis（曜临）** は、最先端のエッジコンピューティングを基盤とした AI プロフィール写真生成システムです。複雑な AI 生成プロセスを「撮影・選択・生成」のシンプルな 3 ステップに凝縮し、スタジオクオリティの写真をすべてのユーザーに提供します。

---

## ✨ 主な特徴

- **📸 没入型カメラシステム**: WebRTC を高度に統合。リアルタイムプレビュー、前後カメラ切り替え、自撮りガイド機能を搭載。
- **🌐 多言語対応 (i18n)**: 中国語、英語、日本語、フランス語、スペイン語のリアルタイム切り替えに対応。
- **⚡ エッジコンピューティング構成**: Cloudflare Workers によるフルスタック展開。グローバルな低遅延レスポンスと、サーバーメンテナンス不要の構成を実現。
- **🛡️ プライバシーとセキュリティ**: 写真は暗号化された R2 バケットに保存され、処理完了後に自動的に削除されます。
- **🎨 精緻なスタイルカスタマイズ**: ビジネス、IT、ファッションなど、多彩なスタイルを内蔵。プロンプトによる微調整も可能。
- **🤖 自動品質チェック**: アップロード時に照明、角度、遮蔽物を自動検出し、最高の結果を保証。
- **📈 管理ダッシュボード**: ユーザーの利用状況や生成タスクを一元管理。

---

## 🛠️ 技術スタック

| モジュール | 実装技術 |
| :--- | :--- |
| **フロントエンド** | Vanilla HTML5/CSS3 + JS (フレームワーク非依存、SEO 最適化) |
| **バックエンド** | Cloudflare Workers (JavaScript/ESM) |
| **データベース** | Cloudflare D1 (Serverless SQL) |
| **ストレージ** | Cloudflare R2 (Object Storage) |
| **デプロイ** | Wrangler CLI / GitHub Actions |

---

## 🚀 クイックスタート

### 1. 準備
```bash
git clone https://github.com/T1113/auralis-ai-headshot.git
cd auralis
npm install
```

### 2. クラウド設定
```bash
npx wrangler login
npx wrangler d1 create impeccable-db
npx wrangler r2 bucket create impeccable-uploads
```
*注意: 返された ID を `wrangler.jsonc` に記入してください。*

### 3. デプロイ
```bash
npx wrangler d1 migrations apply impeccable-db
npm run deploy
```

---

## 🤝 貢献とフィードバック

PR や Issue を歓迎します！このプロジェクトが役立った場合は、ぜひ ⭐️ をお願いします！

---

<p align="center">Made with ❤️ for the AI Community</p>
