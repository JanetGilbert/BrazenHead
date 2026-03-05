# Copilot Instructions for BrazenHead Project

This document provides guidance for AI assistants working on the BrazenHead project.

## Project Overview

A React/TypeScript app built with Vite that displays a rigged 3D head model (Three.js) connected to Inworld.ai's REST TTS API for text-to-speech with real-time lip-sync animation via viseme data. Currently in test mode with a hardcoded string; conversation/LLM integration is planned for later.

### Key Technologies
- React 19 + TypeScript
- Vite 7
- Three.js (GLTF model with 50 morph targets)
- Inworld.ai REST TTS API (`POST https://api.inworld.ai/tts/v1/voice`) — returns base64 audio + per-phone viseme symbols with timing
- Web Audio API — browser-side audio decoding (LINEAR16 PCM) and playback
- Express (local dev TTS proxy server)
- Vercel (deployment target — serverless functions + static hosting)

### Inworld Platform Context
The user's Inworld account is on the **newer TTS/LLM platform** (Inworld Studio), NOT the legacy character/scene platform. This means:
- There are **no scenes or characters** — the dashboard has TTS Playground, Voices, Speech-to-Speech, LLM Router.
- The old `@inworld/web-core` and `@inworld/nodejs-sdk` packages are **not used**.
- Authentication uses a **Basic API key** (`Authorization: Basic {key}`), not JWT key/secret pairs.
- The TTS API endpoint is `POST https://api.inworld.ai/tts/v1/voice`.

## Architecture

### Frontend (`src/`)
- **`App.tsx`** — Top-level UI. "Speak" button sends hardcoded test text through `ttsService.speakText()`. Wires viseme callbacks from TTS response to the ThreeScene handle. States: idle / speaking / error.
- **`ThreeScene.tsx`** — Three.js scene with the head model. Exposes a `ThreeSceneHandle` with `setPhoneme(viseme)` via an `onReady` callback prop. Contains:
  - Delta-time animation loop using `THREE.Clock`
  - Viseme lerp system — smoothly interpolates morph target weights toward the target pose each frame (`VISEME_LERP_SPEED = 16`)
  - Idle blink cycle — random blinks every 2–6 seconds using the `Blink` morph target
- **`ttsService.ts`** — REST TTS client. `speakText(text, onViseme, onError)` calls the backend proxy, decodes LINEAR16 base64 audio to an `AudioBuffer`, plays it via Web Audio API, and schedules viseme callbacks with `setTimeout` based on each phone's `startTimeSeconds`. Key functions:
  - `synthesize(text)` — POSTs to `/api/tts`, returns `{ audioContent, timestampInfo }`
  - `decodeLinear16(base64, sampleRate)` — converts base64 LINEAR16 PCM to `AudioBuffer`
  - `playWithVisemes(audioBuffer, timestampInfo, onViseme)` — plays audio and schedules viseme dispatch
- **`visemeMap.ts`** — Maps Inworld TTS API viseme symbols (Oculus-style: PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, ih, oh, ou) AND IPA phoneme fallbacks to the Miku model's morph targets (`Ah`, `Ch`, `U`, `E`, `Oh`, `Hmm`, `Wa`) with per-target weights. `getBlendShapesForViseme(viseme)` returns `MorphTarget[]`.
- **`vite-env.d.ts`** — Type declarations for `VITE_TTS_ENDPOINT` environment variable.

### Backend
- **`api/tts.ts`** — Vercel serverless function. Proxies TTS requests to `https://api.inworld.ai/tts/v1/voice` with `Authorization: Basic {INWORLD_API_KEY}`. Sends `audio_encoding: "LINEAR16"`, `sample_rate_hertz: 48000`, `timestamp_type: "WORD"`. Keeps API key server-side.
- **`server/dev-token-server.ts`** — Local Express TTS proxy on port 3001 for development. Same logic as `api/tts.ts`. Vite proxies `/api/*` to this server.

### Configuration
- **`.env.local`** — Contains `INWORLD_API_KEY` (Basic key from Inworld Studio), `INWORLD_VOICE_ID` (default "Dennis"), `INWORLD_MODEL_ID` (default "inworld-tts-1.5-max"), and `VITE_TTS_ENDPOINT=/api/tts` (client-side). Gitignored via `*.local` pattern.
- **`vite.config.ts`** — Dev proxy: `/api` → `localhost:3001`.
- **`vercel.json`** — API route rewrite for production.

## Important Notes & Gotchas

1.  **3D Model Pivot Point**: The GLTF model has a pivot point far below its visual center. It's manually positioned at `y = -75` and scaled to `(80, 80, 80)` in `ThreeScene.tsx`. Don't rely on bounding-box centering.

2.  **React StrictMode Removed**: `StrictMode` was removed from `main.tsx` to prevent double Three.js canvas rendering. Don't re-add without handling cleanup.

3.  **Asset Paths**: The GLTF model lives in `public/assets/face/` (not `src/assets/`). This is required for Vite production builds — files in `public/` are served as-is. The loader path is `/assets/face/face.gltf`.

4.  **Inworld Platform Is NOT Legacy**: The user's Inworld account uses the new TTS/LLM Studio platform. Do NOT use `@inworld/web-core` or `@inworld/nodejs-sdk` — those are for the legacy character/scene platform which this account does not have. Use the REST API instead.

5.  **Viseme Mapping**: Inworld TTS API returns `visemeSymbol` on each phone (Oculus-style codes like `PP`, `aa`, `CH`). The mapping in `visemeMap.ts` converts these to morph target weights. If lip-sync looks wrong for certain sounds, adjust the weights there.

6.  **Audio Format**: The TTS API returns LINEAR16 PCM (raw 16-bit signed integers, little-endian) as base64. This is NOT a standard browser audio format — it must be manually decoded into an `AudioBuffer` via `decodeLinear16()` in `ttsService.ts`. The sample rate is 48000 Hz.

7.  **Morph Target Names**: The model mesh is named `"Miku"`. It has 50 morph targets including mouth shapes (`Ah`, `Ch`, `U`, `E`, `Oh`, `Hmm`, `Wa`), eye blinks (`Blink`, `Blink L`, `Blink R`), and expressions. Full list is in the GLTF file's `targetNames`.

8.  **WordPress Embed**: Deploy to Vercel, embed via iframe with `allow="microphone"` attribute for browser mic permissions: `<iframe src="https://your-app.vercel.app" allow="microphone"></iframe>`.

9.  **Viseme Timing**: Viseme callbacks are scheduled with `setTimeout` relative to audio playback start time. Each phone in the TTS response has `startTimeSeconds` and `durationSeconds`. The scheduling happens in `ttsService.ts` `playWithVisemes()`.

## npm Scripts
- `npm run dev` — Vite dev server (frontend only)
- `npm run dev:server` — Local TTS proxy server on port 3001
- `npm run dev:all` — Both in parallel (requires `concurrently`)
- `npm run build` — Type-check + Vite production build

## Future Development Guidelines

- When adding new 3D objects, be aware of their pivot points and be prepared to manually adjust positions.
- If adding `StrictMode` back, ensure Three.js cleanup on unmount.
- Viseme weights will need tuning once TTS audio is flowing — log viseme events to console and visually verify each mouth shape.
- **Next major feature**: Add conversation flow — mic input → speech-to-text → LLM (Inworld LLM Router or external) → TTS → lip sync.
- Consider adding emotion-to-expression mapping to drive eyebrow/expression morph targets.

## Maintaining These Instructions

**IMPORTANT**: This file is the primary context document for new Copilot sessions. After any large change (new features, architectural shifts, new dependencies, renamed/moved files, new gotchas), update this file before ending the task. Specifically:
- Update the **Architecture** section if files are added, removed, or restructured.
- Update **Key Technologies** if dependencies are added or removed.
- Update **Important Notes & Gotchas** with any new pitfalls discovered.
- Update **npm Scripts** if new scripts are added.
- Remove or correct any information that has become stale.

General rules:
- Keep these instructions up-to-date.
- Remove obsolete information as the project evolves.
- Add notes about new major architectural changes, dependencies, or important gotchas.

## Conversational style
Do not flatter, scrape or apologize.