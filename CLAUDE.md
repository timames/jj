# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Jumping Jehosaphat" — a browser-based side-scrolling game built with React and HTML5 Canvas. The player character auto-scrolls right and must jump through gaps in pillars (Flappy Bird-style). Jumping is timing-based: tap after landing within a time window to control jump power and angle (early tap = strong/steep, late tap = weak/shallow). If the window expires, an auto-jump fires.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally

## Architecture

Single-file game in `src/App.jsx` (~417 lines). No routing, no state management library, no tests.

- **Rendering:** HTML5 Canvas via `useRef`, driven by `requestAnimationFrame` loop inside a `useEffect`
- **Game state:** Stored in `gameRef` (a `useRef` object), not React state — avoids re-renders during gameplay. React state (`screen`, `score`, `highScore`) is only used for UI overlays (menu/game-over screens)
- **Input:** `pointerdown` events on the canvas trigger `handleTap`, which calculates jump vector based on elapsed time since landing
- **Key constants** at top of `App.jsx`: `GRAVITY`, `SCROLL_SPEED`, `LANDING_WINDOW` (ms), jump power/angle ranges, obstacle sizing/spacing
- **High score:** Persisted in `localStorage` under key `jj_highscore`

## Tech Stack

- React 19, Vite 8, `@vitejs/plugin-react`
- No TypeScript, no CSS files, no test framework
- Styles are inline or in `index.html`'s `<style>` block
