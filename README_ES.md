# Auralis 曜临 - Estación de Fotos de Perfil con IA

<p align="center">
  <img src="banner.png" alt="Auralis Banner" width="800px" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_ZT.md">繁體中文</a> | <a href="README_EN.md">English</a> | <a href="README_JA.md">日本語</a> | <a href="README_FR.md">Français</a> | <b>Español</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stack-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Database-D1-00ADD8?style=for-the-badge&logo=sqlite&logoColor=white" alt="D1">
  <img src="https://img.shields.io/badge/Storage-R2-FF9900?style=for-the-badge&logo=amazon-s3&logoColor=white" alt="R2">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

---

## 🌟 Visión: Retratos profesionales para todos

**Auralis** es un sistema de generación de fotos de perfil con IA basado en computación de vanguardia (edge computing). Simplificamos el complejo proceso de generación con IA en un flujo de trabajo fluido de "Capturar-Seleccionar-Generar", ofreciendo retratos de calidad de estudio para cada usuario.

---

## ✨ Características principales

- **📸 Sistema de cámara inmersivo**: WebRTC integrado para vista previa en tiempo real, cambio de cámara frontal/trasera y guía de selfies incorporada.
- **🌐 i18n Multilingüe**: Soporte para chino, inglés, japonés, francés y español con cambio en tiempo real.
- **⚡ Arquitectura de Edge Computing**: Despliegue completo en Cloudflare Workers para respuesta global en milisegundos y cero mantenimiento de servidor.
- **🛡️ Privacidad y Seguridad**: Las fotos se almacenan en buckets R2 cifrados y se borran automáticamente tras el procesamiento.
- **🎨 Personalización de estilo detallada**: Estilos profesionales integrados (Finanzas, Tecnología, Moda, etc.) con ajustes basados en prompts.
- **🤖 Control de calidad automatizado**: Detecta iluminación, ángulos y oclusiones durante la carga para garantizar la mejor calidad.
- **📈 Panel de gestión**: Monitoreo integral de cuotas de usuario y tareas de generación.

---

## 🛠️ Stack técnico

| Módulo | Implementación |
| :--- | :--- |
| **Frontend** | Vanilla HTML5/CSS3 + JS (0 dependencias, optimizado para SEO) |
| **Backend** | Cloudflare Workers (JavaScript/ESM) |
| **Base de datos** | Cloudflare D1 (Serverless SQL) |
| **Almacenamiento** | Cloudflare R2 (Object Storage) |
| **Despliegue** | Wrangler CLI / GitHub Actions |

---

## 🚀 Inicio rápido

### 1. Requisitos previos
```bash
git clone https://github.com/T1113/auralis-ai-headshot.git
cd auralis
npm install
```

### 2. Recursos en la nube
```bash
npx wrangler login
npx wrangler d1 create impeccable-db
npx wrangler r2 bucket create impeccable-uploads
```

### 3. Desplegar
```bash
npx wrangler d1 migrations apply impeccable-db
npm run deploy
```

---

## 🤝 Contribución

¡PRs e Issues son bienvenidos! Si este proyecto te resulta útil, ¡por favor danos una ⭐️!

---

<p align="center">Hecho con ❤️ para la comunidad de IA</p>
