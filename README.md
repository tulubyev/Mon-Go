# 🇲🇳 Mon-Go — Mongolia Travel Guide

Mobile app for travelers to Mongolia. Maps, phrasebook, AI chat, live interpreter, OCR translator, transport schedules, and currency rates.

**Platforms:** iOS · Android · Web  
**Languages:** Русский · English · 中文 · Монгол

---

## Features

| Screen | Description |
|--------|-------------|
| 🗺️ Map | Interactive map of Ulaanbaatar with POI: museums, hotels, restaurants, cafes, markets, recreation zones |
| 🗣️ Phrases | Mongolian phrasebook with audio (TTS) + audio quiz |
| 💬 Chat | AI assistant about Mongolia (transport, visa, money, safety) |
| 🎙️ Interpreter | Live voice interpreter: record Mongolian speech → Russian translation + suggested replies |
| 📷 OCR | Camera text recognition and translation (Mongolian ↔ Russian) |
| 📋 Ads | Community board for locals and travelers |
| ⚙️ Settings | Language selector (RU / EN / ZH / MN) |

## Tech Stack

- **Expo SDK 57** / React Native 0.86
- **expo-router** — file-based navigation
- **@maplibre/maplibre-react-native v11** + OpenStreetMap tiles
- **i18next** + react-i18next + expo-localization
- **expo-audio** — voice recording
- **expo-image-picker** — camera + gallery

## Backend

[TMB](https://github.com/tulubyev/TMB) — Node.js 18 + PostgreSQL on mon-go.ru

API endpoints: `/api/poi`, `/api/mongolia/chat`, `/api/stt`, `/api/tts`, `/api/ocr`, `/api/interpret`, `/api/transport`, `/api/rates`, `/api/partners`

## Getting Started

```bash
npm install
npx expo start
```

For iOS device:
```bash
eas build --platform ios --profile preview
```

## B2B

Tour agencies, hotels, and services can appear in the app catalog.  
Contact: [mon-go.ru](https://mon-go.ru)

---

*Built with Expo + Claude Code*
