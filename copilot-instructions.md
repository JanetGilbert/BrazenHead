# Copilot Instructions for BrazenHead Project

This document provides guidance for AI assistants working on the BrazenHead project.

## Project Overview

A React/TypeScript app built with Vite that displays a rigged 3D head model (Three.js) connected to Inworld.ai for conversational AI with real-time lip-sync animation. The head listens via microphone, Inworld responds with TTS audio and phoneme data, and the app animates the model's blend shapes to match.

### Key Technologies
- React 19 + TypeScript
- Vite 7
- Three.js (GLTF model with 50 morph targets)
- Inworld.ai Web SDK (`@inworld/web-core`) — browser-side connection, mic capture, TTS playback, phoneme events
- Inworld.ai Node SDK (`@inworld/nodejs-sdk`) — server-side session token generation
- Express (local dev token server)
- Vercel (deployment target — serverless functions + static hosting)

## Architecture

### Frontend (`src/`)
- **`App.tsx`** — Top-level UI. Connect/Disconnect buttons, mic toggle, response text display. Wires Inworld phoneme events to the ThreeScene handle.
- **`ThreeScene.tsx`** — Three.js scene with the head model. Exposes a `ThreeSceneHandle` with `setPhoneme(phoneme)` via an `onReady` callback prop. Contains:
  - Delta-time animation loop using `THREE.Clock`
  - Viseme lerp system — smoothly interpolates morph target weights toward the target pose each frame
  - Idle blink cycle — random blinks every 2–6 seconds using the `Blink` morph target
- **`visemeMap.ts`** — Maps IPA phoneme strings (from Inworld's `AdditionalPhonemeInfo`) to the Miku model's morph targets (`Ah`, `Ch`, `U`, `E`, `Oh`, `Hmm`, `Wa`) with per-target weights. Returns empty array for silence/unmapped phonemes.
- **`inworldService.ts`** — Inworld connection manager. Configures the `InworldClient`, handles session tokens, mic start/stop, text sending, phoneme dispatch. Uses `autoReconnect` (SDK default) — do NOT call `connection.open()` manually.
- **`vite-env.d.ts`** — Type declarations for `VITE_*` environment variables.

### Backend
- **`api/token.ts`** — Vercel serverless function. Calls `InworldClient.generateSessionToken()` using server-side env vars and returns the token JSON to the browser.
- **`server/dev-token-server.ts`** — Local Express server on port 3001 for development. Same logic as `api/token.ts`. Vite proxies `/api/*` to this server.

### Configuration
- **`.env.local`** — Contains `INWORLD_KEY`, `INWORLD_SECRET`, `INWORLD_SCENE` (server-side) and `VITE_INWORLD_SCENE`, `VITE_TOKEN_ENDPOINT` (client-side). Gitignored via `*.local` pattern.
- **`vite.config.ts`** — Dev proxy: `/api` → `localhost:3001`.
- **`vercel.json`** — API route rewrite for production.

## Important Notes & Gotchas

1.  **3D Model Pivot Point**: The GLTF model has a pivot point far below its visual center. It's manually positioned at `y = -75` and scaled to `(80, 80, 80)` in `ThreeScene.tsx`. Don't rely on bounding-box centering.

2.  **React StrictMode Removed**: `StrictMode` was removed from `main.tsx` to prevent double Three.js canvas rendering. Don't re-add without handling cleanup.

3.  **Asset Paths**: The GLTF model lives in `public/assets/face/` (not `src/assets/`). This is required for Vite production builds — files in `public/` are served as-is. The loader path is `/assets/face/face.gltf`.

4.  **Inworld autoReconnect**: The SDK's `autoReconnect` is enabled by default. Do NOT call `connection.open()` manually — it will throw. The connection opens automatically on first interaction (mic start or text send).

5.  **Phoneme → Viseme Mapping**: Inworld sends IPA phoneme strings (e.g. `"æ"`, `"k"`, `"ʃ"`), not Oculus/ARKit viseme IDs. The mapping in `visemeMap.ts` converts these to morph target weights. If lip-sync looks wrong for certain sounds, adjust the weights there.

6.  **Morph Target Names**: The model mesh is named `"Miku"`. It has 50 morph targets including mouth shapes (`Ah`, `Ch`, `U`, `E`, `Oh`, `Hmm`, `Wa`), eye blinks (`Blink`, `Blink L`, `Blink R`), and expressions. Full list is in the GLTF file's `targetNames`.

7.  **WordPress Embed**: Deploy to Vercel, embed via iframe with `allow="microphone"` attribute for browser mic permissions: `<iframe src="https://your-app.vercel.app" allow="microphone"></iframe>`.

## npm Scripts
- `npm run dev` — Vite dev server (frontend only)
- `npm run dev:server` — Local token server on port 3001
- `npm run dev:all` — Both in parallel (requires `concurrently`)
- `npm run build` — Type-check + Vite production build

## Future Development Guidelines

- When adding new 3D objects, be aware of their pivot points and be prepared to manually adjust positions.
- If adding `StrictMode` back, ensure Three.js cleanup on unmount.
- Viseme weights will need tuning once TTS audio is flowing — log phoneme events to console and visually verify each mouth shape.
- Consider adding emotion-to-expression mapping (Inworld sends `EmotionEvent` with behavior codes) to drive eyebrow/expression morph targets.

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