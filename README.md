# 🏐 Ragdoll Volleyball — HTML5 Remake

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![PixiJS](https://img.shields.io/badge/PixiJS-8-ff4081)
![planck.js](https://img.shields.io/badge/planck.js-Box2D%20port-2e7d32)
![Howler.js](https://img.shields.io/badge/Howler.js-audio-ffb300)
![Biome](https://img.shields.io/badge/Biome-lint%20%2B%20format-60a5fa?logo=biome&logoColor=white)

A **1:1 HTML5/JS remake** of the Flash game **Ragdoll Volleyball** (`RV.swf`) — a
physics-based ragdoll volleyball originally distributed by bubblebox.com (2008).

## About

This is **not** a from-scratch project: the original game's art, sounds and logic were
**extracted by decompiling `RV.swf`** with the
[JPEXS Free Flash Decompiler (FFDec)](https://github.com/jindrapetrik/jpexs-decompiler),
and the game was **reimplemented in TypeScript**, staying faithful to the original
behavior (physics, rules, AI, levels, etc.). The vector/bitmap assets rasterized by
FFDec are used directly as textures.

## Features

- **Local 2-player** and **1-player vs CPU** (a 5-level campaign with unlocking,
  per-level high scores and a total score — persisted in `localStorage`).
- Physics **ragdolls** (13 bodies + joints + the prismatic "cage"), ball, net and court
  reproduced from the original Box2D physics.
- The **Executer** (the homing wrecking-ball hazard), the 3-touch rule, goal slow-mo,
  and the serve countdown.
- **Audio** (SFX + music), **options** (player colors/sex, volume, shadows) and
  **menus** (start, level select, instructions, in-game menu).
- **Responsive**: fills the window while keeping the (~3:2) aspect ratio, with an
  adjustable `resolution` (ready for a future HD pass).

## Stack

| Layer | Lib |
|---|---|
| Rendering | [PixiJS v8](https://pixijs.com/) (Flash-like display list: filters, blend modes, color transform) |
| Physics | [planck.js](https://piqnt.com/planck.js) (a Box2D 2.x port — maps ~1:1 to the original) |
| Audio | [Howler.js](https://howlerjs.com/) |
| Build | [Vite](https://vite.dev/) + TypeScript |
| Lint/Format | [Biome](https://biomejs.dev/) |

## Running

```bash
pnpm install
pnpm dev        # dev server (http://localhost:5173)
pnpm build      # production build into dist/
pnpm preview    # serve the build
```

Lint/format:

```bash
pnpm check      # biome check --write (lint + format + organize imports)
pnpm format     # format only
pnpm lint       # lint only
```

> For format-on-save in VSCode, install the **Biome** extension (`biomejs.biome`) —
> `.vscode/settings.json` already sets it as the default formatter.

## Controls

- **Player 1:** ← / → move · ↑ jump · ↓ spike · **Space** serve
- **Player 2:** A / D move · W jump · S spike · **R** serve
- Menus via **mouse**. `Esc` back to menu · `P` pause · ` (backtick) toggles the physics debug.

## Structure

```
src/
  core/       constants, options, campaign (persistence), assets, types
  physics/    planck world + contact listener
  entities/   ball, ragdoll (player), court
  staff/      executer + prize button
  player/     AI
  input/      keyboard + control mapping
  render/     world layer (scale/offset), debug, "blood", color
  audio/      Howler wrapper
  screens/    start menu, level select, options, instructions, in-game menu
  game/       Game (rules/score) + GameWorld (orchestrator)
public/assets/  sprites, images, sounds and fonts extracted from the SWF
```

## Credits

- **Original game:** *Ragdoll Volleyball* by **Bedalaga & iLDico** © 2008 (bubblebox.com).
- **Remake:** Bruno Monteiro.

Non-commercial fan remake, for educational/preservation purposes. All rights to the
original game belong to its authors.
