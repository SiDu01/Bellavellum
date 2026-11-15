# Bellavellum

Portable Electron virtual tabletop for the DM, run from a USB stick. Plan and milestones: `PLAN.md`.

## Commands

- `npm run dev` – start with hot reload
- `npm run typecheck` / `npm test` / `npm run build`
- `npm run dist:win` – portable `dist/Bellavellum.exe`
- `npm run dist:linux` – AppImage (Linux/WSL only)

## Learnings

- Windows removable drives have no recycle bin, so deletes go to `data/trash/`, never `shell.trashItem`.
- The AppImage cannot be built on Windows (electron-builder symlink EPERM); use WSL/Linux.
- Fog masks must be fully decoded before replacing the old one, otherwise players briefly see the uncovered map.
