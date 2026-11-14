# Bellavellum – Plan

A portable virtual tabletop for the DM: store maps, prepare scenes, and show them to the players
on a second monitor/TV during D&D or Pathfinder sessions. Runs straight from a USB stick.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| App type | Electron desktop app | Same Chromium engine on every OS, so GIF/WebM/MP4/SVG/ICO render identically. Multi-window and display placement built in. |
| Language | TypeScript (strict) | |
| UI | React + Vite (via electron-vite) | Editor UI with lists, panels and properties. |
| Package manager | npm | |
| Player display | Second window, fullscreen on the external monitor/TV of the same PC | No network needed. |
| Storage | Plain files in `data/` next to the app on the stick | Portable, inspectable, backup = copy the folder. |
| Editing | Non-destructive: originals stay untouched, crop/rotate/position stored in the scene | No data loss, re-editable. |

## Layout on the USB stick

```
BELLAVELLUM/                  (stick formatted as exFAT: readable on Win/macOS/Linux, no 4 GB limit)
  Bellavellum.exe             Windows (portable, no install)
  Bellavellum.AppImage        Linux
  data/
    assets/
      maps/  props/  tokens/  effects/
    thumbs/                   generated previews, safe to delete
    trash/                    deleted assets (removable drives have no OS recycle bin)
    scenes/
      <scene-id>.json
      <scene-id>.fog.png
```

The app locates `data/` relative to its own executable (on Windows portable builds via
`PORTABLE_EXECUTABLE_DIR`, because the exe unpacks to a temp folder).

## Data model

- **Asset**: a file in `data/assets/<kind>/`, kind = map | prop | token | effect.
- **Scene** (JSON):
  - `layers[]`: ordered list; each references an asset with position, scale, rotation, crop,
    opacity, blend mode, visible flag. Maps, props and effects are all layers – that covers
    combining maps, adding props and overlaying effects with one mechanism.
  - `grid`: type (square/hex), cell size, offset, color, visible.
  - `tokens[]`: asset, position, size in cells, label.
  - `fog`: enabled flag; mask stored as `<scene-id>.fog.png`.
  - `view`: what the players see (center, zoom).

## Formats

| Format | Handling |
|---|---|
| PNG, JPG, WebP, SVG, ICO, GIF | Shown directly (`<img>`; GIF animates natively) |
| WebM, MP4 | `<video>` loop, muted. WebM can carry transparency; MP4 effects without alpha use blend mode `screen` (black background disappears) |
| PDF | On import: each page rendered to PNG with pdf.js, user picks the pages to keep |

## Rendering

- Scene = stacked DOM elements with CSS transforms (images, videos), plus one canvas for the grid
  and one for the fog.
- DM window: full editor, fog shown semi-transparent, hidden layers visible to the DM.
- Player window: same renderer, read-only, fog opaque, no UI. Receives state from the DM window
  via Electron IPC.
- DM can edit the next scene while the players still see the live one; "Go live" switches.

## Milestones

Each milestone ends with something usable and is tested from a real USB stick on Windows.

1. **Skeleton** – Electron app starts from the stick, finds `data/`, opens the player window
   fullscreen on the second display. Windows portable build.
2. **Library** – drag & drop import of all formats above, PDF page import, thumbnails, sort into
   maps/props/tokens/effects, delete (to `data/trash/`).
3. **Scenes & layers** – create/save scenes, add maps/props/effects as layers, move/scale/rotate/
   crop, order, opacity, blend mode. Pan/zoom. Go live to the player window.
4. **Grid & tokens** – square/hex grid, calibrate to the map (drag over one cell), tokens snap to
   the grid.
5. **Fog of war** – cover all, reveal/hide with brush and rectangle, saved per scene.
6. **Linux build** – AppImage. (macOS deferred.)

## Out of scope (for now)

Networked players, dynamic lighting/line of sight, dice, character sheets, audio,
rules integration, cloud sync.

## Risks

- **macOS**: the build needs a Mac (or a CI runner with macOS). Without paid code signing,
  Gatekeeper blocks the first start; the user must right-click → Open once.
- **Linux**: AppImage needs the exFAT stick mounted with execute permission.
- **Size**: ~100–150 MB per OS build. Fine for a stick.
- **USB speed**: large maps and videos load slower from cheap sticks; thumbnails keep the library fast.

## Settled

- Targets: Windows first, then Linux. macOS deferred.
- Stick is formatted exFAT.
