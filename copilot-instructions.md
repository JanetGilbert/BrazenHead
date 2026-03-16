# Copilot Instructions for BrazenHead Project

This document provides guidance for AI assistants working on the BrazenHead project.

## Project Overview

A React/TypeScript app built with Vite that displays a rigged 3D head model (Three.js) as an interactive conversational oracle. User speech is captured via microphone, transcribed with HuggingFace Whisper (STT), sent to a HuggingFace-hosted LLM for a conversational reply, then spoken aloud via Google Cloud Text-to-Speech API with real-time lip-sync animation via client-side viseme generation.

### Key Technologies
- React 19 + TypeScript
- Vite 7
- Three.js (GLTF model with 50 morph targets)
- Google Cloud Text-to-Speech API (`POST https://texttospeech.googleapis.com/v1/text:synthesize?key={GOOGLE_TTS_KEY}`) — returns base64 audio (LINEAR16 PCM)
- Web Audio API — browser-side audio decoding (LINEAR16 PCM) and playback
- Client-side viseme generation — text-based phoneme-to-viseme mapping (no API phoneme data dependency)
- Express (local dev TTS proxy server)
- HuggingFace Inference API — chat completions via `Qwen/Qwen2.5-7B-Instruct` (OpenAI-compatible endpoint at `https://router.huggingface.co/v1`)
- Vercel (deployment target — serverless functions + static hosting)

### Google Cloud TTS Configuration
The TTS integration uses **Google Cloud Text-to-Speech API**:
- **API Key**: Stored in `.env.local` as `GOOGLE_TTS_KEY` (API key authentication, passed as query parameter)
- **Voice**: Fixed to `en-US-Neural2-A` (professional neural voice)
- **Audio Encoding**: LINEAR16 PCM at 48000 Hz (no phoneme timing data from API)
- **Viseme Generation**: Client-side only — text is mapped to viseme symbols via grapheme rules in `visemeGenerator.ts`, then distributed across the audio duration

## Architecture

### Frontend (`src/`)
- **`App.tsx`** — Top-level UI and conversation controller. States: idle / recording / processing / speaking / error. Maintains multi-turn conversation history in a ref (initialized with the system prompt from `chatService.ts`). Flow: "Speak" button → mic recording → "Done" button → STT transcription → LLM chat → TTS with lip-sync. When `SAVE_TEST_DATA` is true, registers an **F9 cheat key** that calls `playTestData()` to replay saved test data with lip-sync (no API calls needed).
- **`chatService.ts`** — LLM conversation client. `sendChat(messages)` POSTs to `/api/chat` (server-side proxy) and returns the assistant's reply text. Exports `ChatMessage` type and `SYSTEM_PROMPT` constant (defines the Brazen Head character: ancient bronze oracle, brief/cryptic responses, 1-3 sentences max).
- **`ThreeScene.tsx`** — Three.js scene with the head model (`/assets/dummy/dummy.gltf`, scale 1, rotation `x = π/2`, position `y = -4`). Exposes a `ThreeSceneHandle` with `setPhoneme(viseme)` via an `onReady` callback prop. Finds the face mesh by traversing for the first mesh with `morphTargetInfluences`. Contains:
  - Delta-time animation loop using `THREE.Clock`
  - Viseme lerp system — smoothly interpolates morph target weights toward the target pose each frame (`VISEME_LERP_SPEED = 16`)
  - Idle blink cycle — random blinks every 2–6 seconds using the `blink_left` / `blink_right` morph targets
- **`ttsService.ts`** — REST TTS client. `speakText(text, onViseme, onError)` calls the backend proxy, decodes LINEAR16 base64 audio to an `AudioBuffer`, plays it via Web Audio API, and schedules viseme callbacks with `setTimeout` based on each phone's `startTimeSeconds`. Uses client-side viseme generation via `generateVisemes()` (no API phoneme data). Key functions:
  - `synthesize(text)` — POSTs to `/api/tts`, returns `{ audioContent }`
  - `decodeLinear16(base64, sampleRate)` — converts base64 LINEAR16 PCM to `AudioBuffer`
  - `playWithVisemes(response, onViseme)` — plays audio and schedules viseme dispatch via client-side generated phoneme timing
  - `saveTestData(response, label)` — when `SAVE_TEST_DATA` is true, persists audio + phoneme data to `test_data/` via the dev server
  - `playTestData(onViseme, onError)` — loads `test_data/Test.pcm` + `Test.json` from the dev server and plays back with lip-sync
  - `SAVE_TEST_DATA` — exported flag; enables saving TTS responses to disk and the F9 cheat key
- **`visemeMap.ts`** — Maps client-side generated viseme symbols (`sil`, `aei`, `o`, `ee`, `bmp`, `fv`, `l`, `r`, `th`, `qw`, `cdgknstxyz` from `visemeGenerator.ts`) to the model's morph targets (`v_aa`, `v_ch`, `v_dd`, `v_ee`, `v_ff`, `v_ih`, `v_kk`, `v_nn`, `v_oh`, `v_ou`, `v_pp`, `v_rr`, `v_sil`, `v_ss`, `v_th`) with per-target weights. `getBlendShapesForViseme(viseme)` returns `MorphTarget[]`.
- **`vite-env.d.ts`** — Type declarations for `VITE_TTS_ENDPOINT` environment variable.

### Backend
- **`api/chat.ts`** — Vercel serverless function. Proxies chat requests to `https://router.huggingface.co/v1/chat/completions` with `Authorization: Bearer {HUGGINGFACE_API_KEY}`. Accepts `{ messages }` array, sends to HuggingFace with `max_tokens: 150`, returns `{ reply }`. Model configurable via `HUGGINGFACE_CHAT_MODEL` env var (default `Qwen/Qwen2.5-7B-Instruct`). Keeps API key server-side.
- **`api/tts.ts`** — Vercel serverless function. Proxies TTS requests to `https://texttospeech.googleapis.com/v1/text:synthesize` with API key in query parameter. Accepts `{ text }`, sends to Google Cloud TTS with voice `en-US-Neural2-A`, audioEncoding `LINEAR16`, sampleRateHertz `48000`, returns `{ audioContent }`. Keeps API key server-side.
- **`server/dev-token-server.ts`** — Local Express proxy on port 3001 for development. Mirrors all three serverless functions (`/api/stt`, `/api/chat`, `/api/tts`). Vite proxies `/api/*` to this server. Also provides:
  - `POST /api/save-test-data` — saves audio (.pcm) + phoneme data (.json) to `test_data/` (body limit 20MB)
  - `GET /api/test-data/:filename` — serves files from `test_data/` for playback

### Configuration
- **`.env.local`** — Contains `GOOGLE_TTS_KEY` (API key for Google Cloud Text-to-Speech), `HUGGINGFACE_API_KEY` (Bearer token, used for both STT and chat), `HUGGINGFACE_CHAT_MODEL` (optional, default `Qwen/Qwen2.5-7B-Instruct`), and `VITE_TTS_ENDPOINT=/api/tts` (client-side). Gitignored via `*.local` pattern.
- **`vite.config.ts`** — Dev proxy: `/api` → `localhost:3001`.
- **`vercel.json`** — API route rewrite for production.

## Important Notes & Gotchas

1.  **React StrictMode Removed**: `StrictMode` was removed from `main.tsx` to prevent double Three.js canvas rendering. Don't re-add without handling cleanup.

2.  **Asset Paths**: The GLTF model lives in `public/assets/dummy/` (not `src/assets/`). This is required for Vite production builds — files in `public/` are served as-is. The loader path is `/assets/dummy/dummy.gltf`.

3.  **Google Cloud TTS Integration**: Uses the REST API endpoint with query-parameter authentication (`?key={API_KEY}`). The API returns base64 LINEAR16 PCM audio only (no phoneme timing data). Viseme generation is entirely client-side via text-to-phoneme rules in `visemeGenerator.ts`.

4.  **Client-Side Viseme Generation**: The `visemeGenerator.ts` module converts text to a sequence of viseme symbols using grapheme-to-phoneme rules and distributes their timing proportionally across the audio duration. This means viseme accuracy depends on text-based heuristics, not speech recognition or API phoneme data.

5.  **Audio Format**: The TTS API returns LINEAR16 PCM (raw 16-bit signed integers, little-endian) as base64. This is NOT a standard browser audio format — it must be manually decoded into an `AudioBuffer` via `decodeLinear16()` in `ttsService.ts`. The sample rate is 48000 Hz.

6.  **WordPress Embed**: Deploy to Vercel, embed via iframe with `allow="microphone"` attribute for browser mic permissions: `<iframe src="https://your-app.vercel.app" allow="microphone"></iframe>`.

7.  **Viseme Timing**: Viseme callbacks are scheduled with `setTimeout` relative to audio playback start time. Each phone in the client-generated viseme list has `startTimeSeconds` and `durationSeconds`. The scheduling happens in `ttsService.ts` `playWithVisemes()`.

## npm Scripts
- `npm run dev` — Vite dev server (frontend only)
- `npm run dev:server` — Local TTS proxy server on port 3001
- `npm run dev:all` — Both in parallel (requires `concurrently`)
- `npm run build` — Type-check + Vite production build

## Future Development Guidelines

- When adding new 3D objects, be aware of their pivot points and be prepared to manually adjust positions.
- If adding `StrictMode` back, ensure Three.js cleanup on unmount.
- Viseme weights will need tuning once TTS audio is flowing — log viseme events to console and visually verify each mouth shape.
- Consider adding emotion-to-expression mapping to drive eyebrow/expression morph targets.
- Consider adding a UI button to reset conversation history (currently resets on page reload).
- The system prompt in `chatService.ts` (`SYSTEM_PROMPT`) defines the Brazen Head character. Adjust tone, verbosity, or personality there.

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