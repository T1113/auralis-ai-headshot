# Auralis 曜临 - Station de Photos de Profil AI

<p align="center">
  <img src="banner.png" alt="Auralis Banner" width="800px" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_ZT.md">繁體中文</a> | <a href="README_EN.md">English</a> | <a href="README_JA.md">日本語</a> | <b>Français</b> | <a href="README_ES.md">Español</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stack-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Database-D1-00ADD8?style=for-the-badge&logo=sqlite&logoColor=white" alt="D1">
  <img src="https://img.shields.io/badge/Storage-R2-FF9900?style=for-the-badge&logo=amazon-s3&logoColor=white" alt="R2">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

---

## 🌟 Vision : Des portraits professionnels pour tous

**Auralis** est un système de génération de photos de profil par IA basé sur une informatique de pointe (edge computing). Nous simplifions le processus complexe de génération d'IA en un flux de travail fluide "Capturer-Sélectionner-Générer", offrant des portraits de qualité studio à chaque utilisateur.

---

## ✨ Caractéristiques principales

- **📸 Système de caméra immersif** : WebRTC intégré pour une prévisualisation en temps réel, commutation de caméra avant/arrière et conseils de selfie intégrés.
- **🌐 Multilingue i18n** : Prise en charge du chinois, de l'anglais, du japonais, du français et de l'espagnol avec commutation en temps réel.
- **⚡ Architecture Edge Computing** : Déploiement complet sur Cloudflare Workers pour une réponse mondiale en millisecondes et zéro maintenance de serveur.
- **🛡️ Confidentialité et Sécurité** : Les photos sont stockées dans des compartiments R2 cryptés et automatiquement effacées après traitement.
- **🎨 Personnalisation fine du style** : Styles professionnels intégrés (Finance, Tech, Mode, etc.) avec ajustements basés sur des prompts.
- **🤖 Contrôle qualité automatisé** : Détecte la lumière, les angles et les occlusions lors du téléchargement pour garantir une qualité optimale.
- **📈 Tableau de bord de gestion** : Surveillance complète des quotas d'utilisateurs et des tâches de génération.

---

## 🛠️ Stack technique

| Module | Implémentation |
| :--- | :--- |
| **Frontend** | Vanilla HTML5/CSS3 + JS (0 dépendance, optimisé SEO) |
| **Backend** | Cloudflare Workers (JavaScript/ESM) |
| **Base de données** | Cloudflare D1 (Serverless SQL) |
| **Stockage** | Cloudflare R2 (Object Storage) |
| **Déploiement** | Wrangler CLI / GitHub Actions |

---

## 🚀 Démarrage rapide

### 1. Prérequis
```bash
git clone https://github.com/T1113/auralis-ai-headshot.git
cd auralis
npm install
```

### 2. Ressources Cloud
```bash
npx wrangler login
npx wrangler d1 create impeccable-db
npx wrangler r2 bucket create impeccable-uploads
```

### 3. Déployer
```bash
npx wrangler d1 migrations apply impeccable-db
npm run deploy
```

---

## 🤝 Contribution

Les PR et les Issues sont les bienvenus ! Si vous trouvez ce projet utile, n'hésitez pas à lui donner une ⭐️ !

---

<p align="center">Réalisé avec ❤️ pour la communauté IA</p>
