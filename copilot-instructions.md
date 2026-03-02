# Copilot Instructions for BrazenHead Project

This document provides guidance for AI assistants working on the BrazenHead project.

## Project Overview

This is a React/TypeScript application built with Vite that displays a 3D model using Three.js.

### Key Technologies
- React
- TypeScript
- Vite
- Three.js

## Important Notes & Gotchas

1.  **3D Model Pivot Point**: The primary GLTF model (`/src/assets/cpckwp_face-gltf/scene.gltf`) has a pivot point located far below its visual center. Automatic centering logic based on the model's bounding box will likely fail. The model's position has been manually adjusted in `src/ThreeScene.tsx` to compensate for this. Be mindful of this if you need to further adjust the model's scale or position.

2.  **React StrictMode**: React's `StrictMode` was removed from `src/main.tsx`. It was causing the Three.js canvas to render twice in development, creating a "doubled" scene effect. Do not re-introduce `StrictMode` around the `App` component without accounting for this behavior, as it can lead to unexpected visual bugs and resource issues with the Three.js renderer.

3.  **File Paths**: The GLTF model is loaded using a path relative to the `public` directory. Ensure any new assets are placed in the `public` directory or that paths are correctly handled by Vite.

## Future Development Guidelines

- When adding new 3D objects, be aware of their pivot points and be prepared to manually adjust their positions if they don't appear as expected.
- If you need to add back `StrictMode`, ensure that the Three.js scene is properly cleaned up on component unmount to prevent memory leaks and visual artifacts from the double render.
- Keep the scene lighting and camera position in mind when adding new objects to ensure they are visible.
