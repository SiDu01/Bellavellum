# Bellavellum – Vollständiger UI/UX- & Material-3-Umsetzungsplan

> **Grundlage:** Alle statischen und live verifizierten Befunde aus [UI_UX_M3_AUDIT.md](file:///d:/Dev/Bellavellum/UI_UX_M3_AUDIT.md).
> **Architektur-Leitplanken:**
> - Keine neuen schweren UI-Frameworks (weiterhin React 19 + strenges TypeScript + natives CSS/HTML `<dialog>`, `color-mix()`, `@container`).
> - **Abwärtskompatibilität:** Bestehende Daten in `data/scenes/*.json`, `data/assets/*` und `data/settings.json` bleiben vollständig lesbar (`settings.json` wird um das optionale Feld `theme` ergänzt, per Read-Merge-Write ohne Verlust von `playerDisplay`).
> - **Neue IPC-Endpoints** (bewusst abgestimmt): `settings:theme` (get/set), `library:references`, `library:rename`, `library:restore`, `scenes:restore` – sauber typisiert in `src/shared/types.ts` und `src/preload/index.ts` inkl. Unit-Tests in `src/main/*.test.ts`.
> - Jedes Arbeitspaket (AP) hinterlässt das Projekt in einem lauffähigen Zustand (`npm run typecheck`, `npm test`, `npm run build` grün) und kann einzeln umgesetzt und verifiziert werden.

---

## Festgelegte Produktentscheidungen

1. **DM-Fenster-Menüleiste (`AP 2`):** Standard-Chromium-Menüleiste komplett entfernen (`dm.setMenu(null)` wie beim Player); DevTools nur per `F12` / `Ctrl+Shift+I` im Dev-Modus.
2. **Löschen von Szenen & Assets (`AP 5`):** M3-Bestätigungsdialog behalten und optisch nach M3 umbauen (`ConfirmDialog` auf `<dialog>`), **zusätzlich** danach M3-Snackbar mit „Rückgängig“ (Wiederherstellung aus `data/trash/`).
3. **Theme (`AP 1`):** Zusätzlich **M3 Light-Theme** (aus demselben Gold-Seed `#c9a45c`) + Umschalter (`Dunkel` / `Hell` / `System`) in den Einstellungen, gespeichert in `data/settings.json`.
4. **Bibliothek-Erweiterungen (`AP 6`):** Such- & Sortierleiste **plus** **Asset-Umbenennen** (inkl. automatischer Aktualisierung aller Szenen-Referenzen) und **Szenen-Referenzprüfung** vor dem Löschen.
5. **Ebenen-Zeilen-Kompaktheit (`AP 4`):** `Nach oben` / `Nach unten` / `Entfernen` in ein kompaktes **M3-Overflow-Menü (`more_vert`)** bündeln (`Sichtbar` & `Gesperrt` bleiben direkt per Einzelklick erreichbar).
6. **Allgemeines Rückgängigmachen / Undo & Redo (`AP 5` + `AP 6`):**
   - **Im Szenen-Editor:** Sichtbare M3-Buttons **Rückgängig (`undo`)** & **Wiederholen (`redo`)** in der Top Bar sowie `Strg+Z` / `Strg+Umschalt+Z` (`Strg+Y`) über eine gemeinsame chronologische History für **alle** Editor-Aktionen (Ebenen, Tokens, Raster, Räume, Flächen, Zuschnitt/Teilen, Szenenname, Spieler-Ausschnitt **und** Nebel-Operationen).
   - **Bei Szenen- & Asset-Löschungen:** Nach dem M3-Bestätigungsdialog zusätzlich Wiederherstellen per „Rückgängig“-Snackbar direkt aus `data/trash/`.

---

## Abhängigkeitsübersicht der Arbeitspakete

```text
AP 1 (M3-Token-Fundament, Dark+Light Theme, State Layers, Typo, Icons)
  ├──► AP 2 (App-Shell, Rail, FAB, Blackout, State-Erhalt, Electron-Fenster)
  ├──► AP 3 (Input-Bugs, Form-Controls: NumberField, Slider, Switch, TextField, Live-Button)
  └──► AP 4 (Stage-Layout, Floating Toolbars, Framing, Panels, Overflow-Menü, Raum-Labels)
         │
         ├──► AP 5 (M3-Dialoge auf <dialog>, Trash-Restore, Fehler/Snackbars, Progress, Live-Sicherheit)
         └──► AP 6 (Allgemeines Undo/Redo, A11y, Shortcuts, Trackpad-Pan, Bibliothek-Suche/Rename/Refs)
                │
                └──► AP 7 (Sprachkonsistenz, Empty States, Automatisierte Live-Regression)
```

| AP | Titel | Fokus / Risiko | Grober Umfang |
| :--- | :--- | :--- | :--- |
| **AP 1** | M3-Design-System-Fundament & Light/Dark Theme | M3-Tokens (Dark + Light), Theme-Persistenz (`settings.json`), State Layers, Typo (`rem`), Shape, Motion, Icons | ~8 Dateien (`styles.css`, `controls.tsx`, `Settings.tsx`, `main.tsx`, `displays.ts`/Settings-Store, `src/main/index.ts`, `preload/index.ts`, Icon-Aufrufe) |
| **AP 2** | App-Shell, Navigation Rail & State-Erhalt | `position: fixed`-Wegfall, Tab-State bleibt erhalten, Blackout immer da, `dm.setMenu(null)`, Fenster-Minima | ~6 Dateien (`main.tsx`, `Scenes.tsx`, `Library.tsx`, `Settings.tsx`, `Player.tsx`, `src/main/index.ts`) |
| **AP 3** | Kritische UI-/Input-Bugs & Form-Komponenten | `NumberField`, `Slider`, `Switch`, `TextField`, `Live`-Button, `LayerProps`, `Area`-Effekt | ~7 Dateien (`controls.tsx`, `SceneEditor.tsx`, `LayerProps.tsx`, `GridPanel.tsx`, `FogPanel.tsx`, `tools/rooms.tsx`, `styles.css`) |
| **AP 4** | Stage-Layout, Floating Toolbars, Framing & Panels | Clipping/Overflow-Fix ab `960px`, Framing-Fix, einklappbares Panel, Ebenen-Overflow-Menü, Raum-Labels | ~7 Dateien (`SceneEditor.tsx`, `SceneView.tsx`, `tools/*.tsx`, `styles.css`) |
| **AP 5** | M3-Dialoge, Feedback, Progress & Trash-Restore | `<dialog>`-Basis, 0× `confirm()`/`alert()`, M3-Snackbars inkl. Trash-Undo, Progress Bars, Destruktiv-Schutz | ~12 Dateien (neu: `Dialog.tsx`, `Feedback.tsx`; `DisplayPicker`, `AssetPicker`, `PdfImport`, `Scenes`, `Library`, `FogPanel`, `RoomPanel`, `Settings`, `src/main/scenes.ts`, `src/main/library.ts`) |
| **AP 6** | Allgemeines Undo/Redo, A11y, Shortcuts & Bibliothek | Editor-Undo/Redo (`Ctrl+Z` + Buttons inkl. Nebel), WAI-ARIA Tabs, Tooltips, `Escape`, `Space`-Pan, Asset-Rename + Szenen-Referenzprüfung | ~12 Dateien (neu: `history.ts`, `useTablist.ts`; `SceneEditor.tsx`, `tools/fog.tsx`, `Library.tsx`, `AssetPicker.tsx`, `src/main/library.ts`, `src/main/scenes.ts`, `src/main/index.ts`, `preload/index.ts`) |
| **AP 7** | Terminologie, Empty States & Live-Prüfskript | Sprachbereinigung, Empty States, reproduzierbarer CDP-UI-Check (Dark + Light) | ~6 Dateien + Prüfskript |

---

## AP 1 – Material-3-Design-System-Fundament & Light/Dark Theme

**Behebt aus Audit:** 3.1 (Farb-Tokens, Light-Theme, Error-Semantik, Disabled-Opacity, `outline-variant`-Kontrast, Hardcoded Colors), 3.2 (State Layers, `:active`), 3.3 (Type Scale, `line-height`, `tracking`, `Roboto 600`, `rem`-Skalierung), 3.4 (Shape & Elevation), 3.5 (Motion & `prefers-reduced-motion`), 3.6 (Material Symbols Achsen & Legacy-Namen).

### Betroffene Dateien
- `src/shared/types.ts` (`export type ThemeMode = 'dark' | 'light' | 'system'`)
- `src/main/displays.ts` (Read-Merge-Write für `data/settings.json`: `loadTheme` / `saveTheme` neben `playerDisplay`, inkl. Unit-Test in `displays.test.ts`)
- `src/main/index.ts` & `src/preload/index.ts` (`settings:getTheme`, `settings:setTheme`)
- `src/renderer/src/main.tsx` (Theme beim Start anwenden via `document.documentElement.dataset.theme` + `matchMedia('(prefers-color-scheme: light)')`-Listener bei `'system'`)
- `src/renderer/src/Settings.tsx` (Sektion „Darstellung“ mit M3 Connected Button Group `Dunkel` / `Hell` / `System`)
- `src/renderer/src/styles.css`
- `src/renderer/src/controls.tsx`
- Icon-Namen in `Library.tsx`, `RoomPanel.tsx`, `SceneEditor.tsx`, `tools/grid.tsx`, `tools/measure.tsx`

### Konkrete Änderungen
1. **Vollständige M3-Color-Tokens für Dark **und** Light Theme (Seed `#c9a45c`):**
   - **Dark Theme (`:root` / `[data-theme='dark']`):** Bestehende warme Gold-Dark-Palette beibehalten und vervollständigen um `--secondary`, `--on-secondary`, `--on-tertiary`, `--tertiary-container`, `--on-tertiary-container`, `--on-error`, `--surface-lowest`, `--surface-dim`, `--surface-bright`, `--inverse-surface`, `--inverse-on-surface`, `--inverse-primary`, `--scrim: rgb(0 0 0 / 0.32)`, `--scrim-strong: rgb(0 0 0 / 0.6)`, `--icon-grad: -25`.
   - **Light Theme (`[data-theme='light']`):** Vollständiges M3-Light-Scheme aus demselben Gold-Seed `#c9a45c` (`color-scheme: light`, `--primary: #775a0b`, `--on-primary: #ffffff`, `--primary-container: #ffdf9e`, `--on-primary-container: #261a00`, `--secondary-container: #f3e0bb`, `--on-secondary-container: #231a04`, `--error: #ba1a1a`, `--on-error: #ffffff`, `--error-container: #ffdad6`, `--on-error-container: #410002`, `--surface: #fff8f1`, `--surface-low: #faf2e6`, `--surface-container: #f4ece0`, `--surface-high: #eee6da`, `--surface-highest: #e8e0d5`, `--on-surface: #1f1b13`, `--on-surface-variant: #4d4639`, `--outline: #7f7667`, `--outline-variant: #d0c5b4`, `--inverse-surface: #343027`, `--inverse-on-surface: #f8efe3`, `--icon-grad: 0`). Alle Kombinationen vorab rechnerisch auf WCAG AA/AAA prüfen.
   - Karten-Stage (`.stage`), Player-Fenster (`.player`) und Thumbnail-Letterbox behalten bewusst dunklen Canvas-Hintergrund (Spielkarten mit schwarzem Hintergrund/Fog brauchen Kontrast; im Light-Theme z. B. `#12100c` statt grellem Weiß).
   - Alle hartkodierten `rgb(23 19 11 / 0.8)` durch `color-mix(in srgb, var(--surface) 84%, transparent)` und `rgb(233 193 108 / 0.15)` / `rgb(201 164 92 / 0.15)` durch `color-mix(in srgb, var(--primary) 15%, transparent)` ersetzen.
   - Einheitliche `<option>`-Farben für alle `<select>` (`select option { background: var(--surface-high); color: var(--on-surface); }`).
   - Interaktive Grenzen (`.drop-card`, `.pdf-page`) von `--outline-variant` auf `--outline` umstellen (≥ `3:1` in Dark **und** Light).
   - **Settings-Persistenz:** `savePlayerDisplay` und `saveTheme` nutzen denselben Read-Merge-Write-Helper auf `data/settings.json`, sodass das Speichern des Themes niemals den gespeicherten Spielerbildschirm überschreibt (und umgekehrt).
2. **M3-State-Layers & `:active`-States statt `filter: brightness(1.12)`:**
   - Globalen `filter: brightness(1.12)` entfernen.
   - Pro Button-/Container-Rolle ein sauberes State-Layer-Muster über `color-mix(in srgb, <bg>, <on-color> 8%)` (Hover) bzw. `12%` (`:active`) einführen – funktioniert automatisch konsistent in Dark **und** Light Theme!
   - Explizite Hover- und `:active`-Zustände ergänzen für: `.segmented button` (auch unselected & active), `.check input`, `.pdf-page`, `.picker .pick` (ohne Bild-Aufhellung), `.displays button`, `.scene-list li.selected`, `.layers li.selected`.
   - M3-Disabled-Darstellung: Für Filled/Tonal-Buttons `background: color-mix(in srgb, var(--on-surface) 12%, transparent); color: color-mix(in srgb, var(--on-surface) 38%, transparent); opacity: 1;` statt pauschalem `opacity: 0.38`.
   - `fieldset.plain:disabled`: Keine eigene `opacity: 0.5` mehr, stattdessen Kind-Controls konsistent im Disabled-Look rendern (verhindert `0.19` Doppel-Opacity).
3. **Typografie-System in `rem`:**
   - `:root` bleibt bei Basis `14px` (oder `16px` Standard mit exakter M3-Skala in `rem`: Headline Medium `1.75rem/2.25rem`, Headline Small `1.5rem/2rem`, Title Large `1.375rem/1.75rem`, Title Medium `1rem/1.5rem`, Title Small `0.875rem/1.25rem`, Body Large `1rem/1.5rem`, Body Medium `0.875rem/1.25rem`, Body Small `0.75rem/1rem`, Label Large `0.875rem/1.25rem`, Label Medium `0.75rem/1rem`, Label Small `0.6875rem/1rem`) inkl. `line-height` und `letter-spacing`.
   - `font-weight: 600` in `.room-label` und `.area-label` auf `500` umstellen (passt zu geladenem `Roboto 500`, kein Faux-Bold).
   - Panel-Hierarchie angleichen: `.panel h3` auf Title Small (`0.875rem`, `500`, `--primary` wie `.settings-section`), `.check` im Inspector-Panel auf Body Medium (`0.875rem`) statt `16px`, `.prop` auf `0.8125rem`–`0.875rem`.
4. **Shape, Elevation & Motion Tokens:**
   - Shape-Tokens `--shape-xs: 4px`, `--shape-s: 8px`, `--shape-m: 12px`, `--shape-l: 16px`, `--shape-xl: 28px`, `--shape-full: 9999px`.
   - Buttons auf `--shape-full`, `.live-badge` auf `--shape-full`, `.tool-grid button` einheitlich auf `--shape-full` (oder bewusst `--shape-m` für alle Panel-Aktionsblöcke, aber konsistent).
   - Zweischichtige M3-Schatten (`--elev-1`, `--elev-2`, `--elev-3`). Rail-FAB erhält `box-shadow: none` (Elevation 0).
   - Motion-Tokens (`--ease-standard`, `--ease-emphasized`, `--dur-short: 150ms`, `--dur-medium: 250ms`) für Hover/Active-Transitions, `.tile .remove`, Switch-Thumb (`transform` statt `all`), Modal-Fade und Tab-Indikator; dazu globaler `@media (prefers-reduced-motion: reduce)`-Block (deaktiviert `.ping`-Animation und Transitions; SVG-`<animate>` in `SceneView.tsx` über `matchMedia('(prefers-reduced-motion: reduce)')` abschaltbar).
5. **Material Symbols Optimierung & Bereinigung:**
   - `.icon` mit `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' var(--icon-grad, -25), 'opsz' 24;` (Dark Theme `-25`, Light Theme `0`; für `18px`/`20px`-Icons `'opsz' 20`, für `36px`-Icons `'opsz' 40`).
   - Aktive Toggle-Buttons (`.floating-tools button[aria-pressed='true'] .icon`, `.segmented button[aria-pressed='true'] .icon`, `button.icon-btn[aria-pressed='true'] .icon`) auf `'FILL' 1` umschalten.
   - Die 4 Legacy-Alias-Namen auf kanonische Material-Symbols-Namen umstellen und `Icon` streng typisieren (`type IconName = ...`):
     - `push_pin` → `keep`
     - `file_upload` → `upload_file` (oder `upload`)
     - `highlight_alt` → `select`
     - `auto_awesome` trennen: Effekte-Tab → `blur_on` oder `flare` / `animation`; Raster erkennen → `grid_on` oder `auto_fix_high`/`wand_shine`; Gemini-Räume → `wand_stars` / `sparkles` (gegen `index.d.ts` verifizieren).
   - `crop`-Kollision auflösen: „Ausschnitt für Spieler“ in der Top Bar → `aspect_ratio` oder `crop_free`, Ebenenzuschnitt unten behält `crop`.

### Akzeptanzkriterien & Verifikation
- Kontrastprüfung aller Token-Kombinationen in **Dark und Light Theme** ≥ WCAG AA (`4.5:1` Text, `3:1` UI-Grenzen).
- Theme-Umschaltung (`Dunkel` / `Hell` / `System`) in `Einstellungen` wechselt sofort und bleibt nach App-Neustart erhalten, ohne `playerDisplay` in `data/settings.json` zu überschreiben (Unit-Test in `displays.test.ts`).
- Alle Icon-Namen in `material-symbols/index.d.ts` vorhanden.
- Kein `filter: brightness` mehr in `styles.css`; jeder klickbare Button zeigt sichtbaren Hover- und `:active`-State.
- `document.documentElement.style.fontSize = '24px'` skaliert alle Textrollen proportional ohne Clipping.

---

## AP 2 – App-Shell, Navigation Rail, State-Erhalt & Electron-Fenster

**Behebt aus Audit:** 4.1 (Rail/FAB/Blackout-Hacks, Tab-Reihenfolge, Lücke in Einstellungen, gemischte ARIA-Rollen, schmale Klickziele), 4.12 (Englische Menüleiste, fehlende `minWidth`/`minHeight`, Spielerfenster-Titel), 5.1 (State-Verlust beim Tab-Wechsel), 5.2 (Datenordner in Bibliothek statt Einstellungen).

### Betroffene Dateien
- `src/main/index.ts`
- `src/renderer/src/main.tsx`
- `src/renderer/src/Scenes.tsx`
- `src/renderer/src/Library.tsx`
- `src/renderer/src/Settings.tsx`
- `src/renderer/src/Player.tsx`
- `src/renderer/src/styles.css`

### Konkrete Änderungen
1. **Electron-Fenster härten (`src/main/index.ts`, `src/renderer/src/Player.tsx`):**
   - `dm = new BrowserWindow({ width: 1280, height: 800, minWidth: 900, minHeight: 600, ... })`.
   - `dm.setMenu(null)` (und optional im Dev-Modus `before-input-event` für `F12` / `Ctrl+Shift+I` DevTools erhalten).
   - `PlayerView` setzt per `useEffect` bei `className === 'player'`: `document.title = 'Bellavellum – Spieler'`.
   - Im Fenstermodus auf dem Primärbildschirm (über Query-Param `?view=player&windowed=1`) `cursor: default` statt `cursor: none` nutzen.
2. **State-Erhalt beim Tab-Wechsel & gehobener Live-State (`main.tsx`, `Scenes.tsx`, `Library.tsx`):**
   - `liveId` und `goLive(id: string | null)` in `DmView` verwalten und an `Scenes` durchreichen (inkl. Synchronisation beim Löschen einer Live-Szene).
   - `Scenes` und `Library` nicht mehr beim Tab-Wechsel unmounten, sondern über `<div className="view-slot" hidden={tab !== 'scenes'}>` (CSS: `.view-slot[hidden] { display: none; }`) im DOM halten.
   - Effekt: Offene Szene, Kamera, Panel-Tab, Auswahl, Bibliotheks-Kategorie und ein laufender Gemini-Request bleiben beim Tab-Wechsel 100 % erhalten.
   - `hasKey` in `RoomPanel` / `useRoomTool` aktualisieren, sobald `Settings` den Key speichert/entfernt (Callback/State in `DmView` oder Event).
3. **Navigation Rail strukturell M3-konform umbauen (`main.tsx`, `styles.css`):**
   - **Alle `position: fixed`-Hacks (`.fab`, `.fab-slot`, `.blackout`) komplett entfernen!**
   - FAB als reguläres Kind innerhalb `<nav className="rail">` rendern – gesteuert über ein leichtes Action-Prop/Callback für den aktiven Bereich:
     - In `Szenen`: FAB `+` („Neue Szene“)
     - In `Bibliothek`: FAB `upload` („Dateien hinzufügen“)
     - In `Einstellungen`: kein FAB und **kein leeres Platzhalter-Loch** (Rail-Items rücken sauber oder behalten konsistenten Top-Abstand).
   - **Blackout-Button („Ausblenden“)** als reguläres Flex-Element in `<nav className="rail">` über „Spieler“ / „Einstellungen“ rendern, sobald `liveId !== null` – damit ist er in **allen 3 Views** (`Szenen`, `Bibliothek`, `Einstellungen`) immer mit einem Klick erreichbar und überlappt bei keiner Fensterhöhe mehr!
   - Menü-Button (`Szenenliste ein-/ausklappen`): Nur anzeigen bzw. sinnvoll nutzen (in `Szenen` aktiv; auf anderen Tabs entweder sauber verstecken oder als einheitliche Rail-Expansion nutzen – für Einfachheit: nur in `Szenen` sichtbar oder als klarer Drawer-Toggle in der Szenen-Ansicht).
   - **ARIA-Semantik bereinigen:** `role="tablist"` aus `<nav className="rail">` entfernen. Alle drei Hauptziele (`Szenen`, `Bibliothek`, `Einstellungen`) erhalten einheitlich `aria-current={tab === ... ? 'page' : undefined}`. „Spieler“ über eine dezente `1px`-Trennlinie (`.rail-divider`) als Utility-Aktion optisch von den Navigationszielen abgrenzen (inkl. kleinem aktivem Status-Indikator, wenn ein Spielerfenster offen ist).
   - Klickziel jedes `.rail-item` auf `width: 100%; min-height: 56px;` erweitern; Fokusring sauber um das Item/die Pill legen.
4. **App-Metadaten richtig platzieren (`Settings.tsx`, `Library.tsx`):**
   - `info.dataDir` (Datenordner auf dem Stick) in `Settings.tsx` unter einer neuen Sektion „Speicherort / System“ anzeigen (mit Kopier-Button).
   - `info.displayCount` aus dem `Library`-Header entfernen (gehört kontextuell zum „Spieler“-Button / `DisplayPicker`).

### Akzeptanzkriterien & Verifikation
- Live-Tab-Order-Test: Fokus läuft streng top-down durch die Rail (Menü → FAB → Szenen → Bibliothek → Ausblenden → Spieler → Einstellungen → Hauptbereich).
- Wechsel `Szenen` → `Bibliothek` → `Einstellungen` → `Szenen` lässt geöffnete Szene und Kamera unberührt.
- „Ausblenden“ ist während einer Live-Szene in allen 3 Views sichtbar und überlappt auch bei `900×600` nichts.
- Nutzbare Fensterhöhe bei `1280×800` steigt durch Wegfall der englischen Menüleiste um ~`25–30px`.

---

## AP 3 – Kritische UI-/Input-Bugs & Form-Komponenten

**Behebt aus Audit:** 3.1 (`button.live:disabled`), 4.2 (doppelter „Einpassen“-Button), 4.3 (`ModeToggle` in `Räume`), 4.6 (`NumberField`-Bug, Area-Effekt-`<select>`-Bug, 3 Input-Stile, Floating Label, Passwort-Toggle), 4.7 (Slider-Gap-Bug, Centered Slider, `NaN%`, Switch-States & Disabled-Label), 4.11 (`.layer-name`-Ellipsis, nicht deaktivierte Layer-Pfeile, `.area-row`-Gestaltung), 5.2 („Schere-Werkzeug“-Copy-Bug).

### Betroffene Dateien
- `src/renderer/src/controls.tsx` (+ neue `controls.test.ts` für `NumberField`/Slider-Logik)
- `src/renderer/src/SceneEditor.tsx`
- `src/renderer/src/LayerProps.tsx`
- `src/renderer/src/GridPanel.tsx`
- `src/renderer/src/FogPanel.tsx`
- `src/renderer/src/Settings.tsx`
- `src/renderer/src/tools/rooms.tsx`
- `src/renderer/src/styles.css`

### Konkrete Änderungen
1. **`button.live` richtig gestalten (`SceneEditor.tsx:394`, `styles.css:96-99`):**
   - Aktiven Live-Zustand **nicht** über `disabled={isLive}` ausgrauen!
   - Stattdessen:
     - Entweder als aktiver Toggle-Button (`aria-pressed={isLive}`): wenn live, volle Kontraststärke (`--error-container` / `--on-error-container`, `opacity: 1`, pulsierender/fester Live-Punkt, Klick oder separates Ausblenden klar beschriftet) – oder `aria-disabled` / Status-Pill ohne `opacity: 0.38`.
     - Wenn eine *andere* Szene live ist, optional kleinen dezenten Hinweis in der Top Bar zeigen.
2. **`NumberField` reparieren (`controls.tsx:50-66`):**
   - Lokalen `draft: string`-State einführen, synchronisiert mit `value` wenn nicht fokussiert.
   - Während des Tippens darf der Nutzer das Feld leeren, `-` tippen oder `1` als Anfang von `10` eingeben.
   - Gültige Werte (`Number.isFinite(v) && (min === undefined || v >= min)`) werden live gemeldet; bei `onBlur` oder `Enter` wird ein ungültiger/leerer Draft sauber auf den letzten gültigen `value` zurückgesetzt (oder bei `< min` auf `min` geclampt).
   - Unit-Test ergänzen für `Backspace`, Präfix `< min` und negative Eingaben.
3. **`Slider` nach M3-Spec korrigieren (`controls.tsx:23-40`, `styles.css:258-280`):**
   - Gap-Farbe über CSS-Variable `--slider-bg` (Default `var(--surface-low)`, in `.props` überschrieben auf `var(--surface-container)`).
   - `NaN%`-Schutz: `const pct = max > min ? ((value - min) / (max - min)) * 100 : 0`.
   - Prop `centered?: boolean` für `Drehung` (`-180°..180°`): Track-Gradient füllt ab `50%` nach links oder rechts.
   - M3-Stop-Indicator am Track-Ende (`::after`/Gradient), größere Klickzielhöhe (`height: 36px` transparentes Wrapper-Hitbox-Target), Handle verschmälert sich leicht bei `:active` (`4px → 2px`).
4. **`Switch` nach M3-Spec abrunden (`styles.css:202-255`):**
   - `cursor: pointer` auf `.check` (und `cursor: default; opacity: 0.38` auf `.check:has(input:disabled)` → deaktivierter Text „Fog aktiv“ wird ebenfalls gedimmt!).
   - `40px`-State-Layer-Halo um den Handle bei `:hover` / `:focus-visible` / `:active` (per `box-shadow` auf `::after`) und Handle-Expansion auf `26–28px` bei `:active`.
5. **Text Fields & Eingaben vereinheitlichen (`styles.css`, `Settings.tsx`):**
   - Echtes CSS-only Floating Label für `.text-field` (via `placeholder=" "` + `:placeholder-shown` + `:focus-within`), sodass leere Felder wie „Neuer API-Key“ das Label zentriert in `16px` zeigen und beim Tippen/Fokussieren weich nach oben gleiten.
   - Passwort-Sichtbarkeitstoggle (`visibility` / `visibility_off`) als Trailing-Icon-Button in `Settings.tsx`.
   - Konsistentes Focus-Styling (`border-bottom: 2px solid var(--primary)`) auch für `.prop input` und `.prop select`, mit mindestens `40px` Höhe; `.prop`-Grid auf `minmax(88px, auto) minmax(0, 1fr) minmax(48px, auto)` flexibel für 200 %-Textskalierung.
6. **Direkte Bugfixes in Editor, LayerProps & Rooms:**
   - **`.layer-name` (`SceneEditor.tsx:507,607`):** Text in `<span>{l.name}</span>` wrappen + `.layer-name > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }` → saubere Ellipsis (`…`) statt hartem Abschneiden.
   - **Layer-Verschieben (`SceneEditor.tsx:528-533`):** `arrow_upward` bei oberster Ebene (`idx === 0` in reversed list) und `arrow_downward` bei unterster Ebene (`idx === length - 1`) `disabled` setzen.
   - **Flächen-Zeile (`.area-row`, `SceneEditor.tsx:538-590`):**
     - Führendes Form-Icon (`square_foot` / `flare` / `change_history` / `horizontal_rule`) anzeigen und `gap: 8px` vertikal sauber setzen.
     - Effekt-Datei-Bug beheben: Neben dem `<select>` (Optionen: „Kein Effekt“, Feuer/Gift/Eis/Dunkelheit, oder aktiven Dateinamen anzeigen) einen dedizierten Icon-Button (`folder_open` / `movie`) platzieren, der jederzeit `setPickingEffect(...)` öffnet – auch wenn bereits eine Datei gewählt ist!
   - **Copy-Bug (`LayerProps.tsx:78`):** *„Oder mit dem Zuschneiden-Werkzeug ein Rechteck über die Ebene ziehen.“*
   - **Doppelter „Einpassen“-Button:** Aus der unteren Floating Toolbar (`SceneEditor.tsx:470`) entfernen (bleibt oben in der Top Bar bzw. wandert in die Zoom-Kontrolle in AP 4).
   - **`tools/rooms.tsx:221`:** `disabled={!painting}` am `<ModeToggle>` ergänzen.
   - **`.primary`-Überladung auflösen:** Semantische Klassen trennen (`.primary` = Filled CTA, `.tonal` = Tonal, `.selected` = aktiver Toggle/Listenstatus) statt `.primary` dreifach zu überladen.
   - **`.segmented` Border-Fix:** `margin-left: -1px` für `:not(:first-child)` statt nur `:last-child`.

### Akzeptanzkriterien & Verifikation
- Live-Test `NumberField`: `29.29` → `Backspace` leert das Feld → Tippen von `1`, `0` setzt sauber `10`.
- Live-Test `Live`-Button: Kontrast im aktiven Live-Zustand ≥ `7:1` (kein Dimmen).
- Visueller Check `LayerProps`: Kein dunkler Halo um Slider-Thumbs; „90° drehen“ im gesperrten Zustand klar als deaktiviert erkennbar, aber lesbar; `.layer-name` zeigt `…`.
- Flächen-Effekt: Eine zweite Datei lässt sich direkt nach der ersten Datei ohne Umweg über „Kein Effekt“ auswählen.

---

## AP 4 – Stage-Layout, Floating Toolbars, Framing & Responsive Verhalten

**Behebt aus Audit:** 4.2/4.3 (Overflow/Clipping der Floating Toolbars auf `1280×800`, `1024×600`, `960×500`, Kollision mit `.zoom`/`.side-tools`/`.stage-help`, 4 gleichzeitige Highlights in `.side-tools`, doppeltes `.floating-tools`-CSS), 4.11 (einklappbares rechtes Panel, natives `<details>`, leere schwarze Spieler-Vorschau, überladene Ebenen-Zeilen), 6.4 (Framing-Banner oben abgeschnitten, Raum-Label-Kollisionen).

### Betroffene Dateien
- `src/renderer/src/SceneEditor.tsx`
- `src/renderer/src/SceneView.tsx`
- `src/renderer/src/tools/measure.tsx`
- `src/renderer/src/tools/rooms.tsx`
- `src/renderer/src/tools/fog.tsx`
- `src/renderer/src/tools/layerEdit.tsx`
- `src/renderer/src/styles.css`

### Konkrete Änderungen
1. **Stage als CSS Container (`container-type: inline-size`) & überlaufsichere Floating Toolbars:**
   - `.stage` bekommt `container-type: size;`.
   - **Kompaktere Floating Toolbars (M3 Expressive Connected Button Group + Icon-Toolbar):**
     - Alle Kinder in `.floating-tools` einheitlich auf `40px` Höhe (mit `44–48px` Touch-Padding) und konzentrischen Radien (`28px` Container, `8px` Padding, `20px` / `9999px` Buttons).
     - `ModeToggle` (`Aufdecken`/`Verdecken`, `Hinzufügen`/`Entfernen`, `Senkrecht`/`Waagerecht`) erhält kompakte Labels und blendet bei `@container (max-width: 620px)` die Textlabels automatisch aus (nur noch Icons + M3-Tooltip), sodass die maximale Toolbar-Breite unter **`340px`** bleibt → **0 px Clipping** selbst bei `1024×600`!
     - `.room-chip` in `tools/rooms.tsx` auf `max-width: 132px` begrenzen und im M3-Chip-Look (`height: 36px`, `border-radius: 8px`, einheitliche Typografie) stylen.
   - **`.zoom` kollisionsfrei + interaktiv machen:**
     - Statt unten rechts direkt in der Laufbahn von `.floating-tools` zu kleben: als kleine M3-Zoom-Pill oben rechts oder unten rechts mit garantiertem Abstand (oder in der Top Bar rechts neben dem Szenennamen), mit klickbaren `-` / `65 %` (Klick = Einpassen) / `+` Buttons!
   - **`.side-tools` (`tools/measure.tsx`) entzerren & eindeutig machen:**
     - Die 4 Messformen (`Lineal`, `Explosion`, `Kegel`, `Linie`) als kompakte vertikale Bar links oben/mitte (`~220px` hoch statt `454px` → kollidiert nie mehr vertikal mit der unteren Toolbar!).
     - Die 4 Einstellungs-Toggles (`Nur messen` / `Platzieren`, `Spieler sehen Messen`, `Neue Flächen sichtbar`) erst einblenden bzw. als kleine sekundäre Kontext-Leiste (oder mit visuell klar unterschiedenem **Tonal/Outlined-Chip-Style** statt `--primary-container`!) anzeigen, sobald ein Messwerkzeug aktiv ist. Ergebnis: Es leuchtet genau **ein** aktives Werkzeug deutlich auf, nicht 4 gleichzeitig!
   - **`.stage-help` ersetzen:**
     - Das permanente `500px`-Overlay oben rechts entfernen und durch einen kleinen, unauffälligen `?`-Icon-Button (oben rechts in der Stage) ersetzen, der per Klick/Hover einen M3 Rich Tooltip / Popover mit allen Maus- & Tastaturhinweisen öffnet (Ping, Laserpointer, Pan, Zoom, Alt-Modifikatoren).
2. **Framing-Modus reparieren (`SceneEditor.tsx:430-437`, `styles.css:785-805`):**
   - Während `framing === true`: `.floating-tools` und `.side-tools` ausblenden (`!framing && ...`), damit keine Werkzeuge über der Framing-Maske liegen.
   - `.frame-mask span` **innerhalb** des oberen Rahmenrands (`top: 12px; left: 50%; transform: translateX(-50%); max-width: calc(100% - 24px); text-align: center;`) statt `bottom: calc(100% + 4px)` platzieren → wird bei 90 %-Rahmenhöhe **nie mehr abgeschnitten**!
   - Bei Tab-Wechsel im Panel während Framing: entweder Framing sauber beenden oder Panel-Tabs während Framing sperren.
3. **Adaptives Drei-Spalten-Layout & einklappbares Inspector-Panel:**
   - **Rechtes Panel einklappbar machen:** Toggle-Button (`dock_to_left` / `right_panel_close`) in der Top Bar rechts; bei `< 1150px` Fensterbreite optional automatisch Szenenliste einklappen, sobald eine Szene geöffnet wird.
   - **Spieleransicht-Vorschau (`SceneEditor.tsx:484-489`):**
     - Natives `<details>`/`<summary>` durch eine saubere M3-Accordion-Schaltfläche (`min-height: 48px`, `expand_more`-Icon mit Rotation, State Layer) ersetzen.
     - Bei `liveId === null` einen klaren Empty State im Vorschau-Container anzeigen (Icon `tv_off` + *„Keine Szene live“*).
     - Bei Hochformat-Spielermonitor (`player.height > player.width`) `max-height: 160px` kompakt begrenzen, damit die Tabs darunter schneller im Blickfeld bleiben.
   - **Ebenen-Zeilen mit M3-Overflow-Menü entlasten:**
     - `Nach oben`, `Nach unten` und `Entfernen` in ein kompaktes **M3-Overflow-Menü (`more_vert`)** bündeln (`role="menu"` mit `role="menuitem"`, Tastatur-Navigation & `Escape`-Schließen, `--surface-container`-Elevated-Menu-Card mit `4px`/`8px` Radius und `--elev-2`); `Sichtbar` und `Gesperrt` bleiben direkt per 1-Klick erreichbar.
     - Klickziele der verbleibenden 3 Inline-Icons (`Sichtbar`, `Gesperrt`, `Mehr`) wachsen von `32px` auf `40px`, der Ebenenname gewinnt ~`100px` Platz und versehentliches Löschen wird stark reduziert.
     - Im Menü sind „Nach oben“ (oberste Ebene) und „Nach unten“ (unterste Ebene) korrekt `disabled`.
4. **Raum-Overlays & kollidierende Raum-Labels (`SceneView.tsx:334-355`, `tools/rooms.tsx:27`):**
   - `showRooms` kontextsensitiv gestalten: Standardmäßig nur sichtbar, wenn Tab `Räume` oder `Nebel` aktiv ist (mit persistierbarem Override-Toggle „Räume immer anzeigen“), damit die Karte im `Ebenen`- und `Raster`-Tab frei bleibt.
   - `.room-label` lesbar halten: `max-width` relativ zur Raum-Bounding-Box (`b.width`), `overflow: hidden; text-overflow: ellipsis;` und optional leichte Hintergrund-Pill (`rgb(23 19 11 / 0.72)`, `padding: 1px 6px`, `border-radius: 4px`) bzw. Ausblenden bei extrem kleinen Zoomstufen (`boxScreenWidth < 28px`), sodass benachbarte kleine Räume (`Koje`, `Vorratskammer`, `Arrestzelle`) nicht mehr zu Textbrei verschmelzen.

### Akzeptanzkriterien & Verifikation
- Live-Geometrie-Messung bei `1280×800`, `1024×600` und `960×600` über alle 4 Tabs (`Ebenen` + `Teilen`, `Raster`, `Nebel`, `Räume`): **`leftClipPx === 0`, `rightClipPx === 0`, `overlapsZoom === false`, `overlapsSide === false`**.
- Visueller Check Framing-Modus: Hinweistext 100 % lesbar und ungeclippt; keine Floating Toolbars über der Maske.
- Visueller Check Schiffskarte: Keine kollidierenden Raum-Labels (`KojVorratskaArrestzelle`-Problem gelöst).

---

## AP 5 – M3-Dialoge, Feedback-System, Progress Indicators & Trash-Restore

**Behebt aus Audit:** 4.9 (Focus Trap, Auto-Focus, Focus-Restore, Scrim-Dismiss, `Escape` in `PdfImport`, `DisplayPicker`-Breite max `560px`, Scroll-Divider, `window.confirm`/`alert`, `PdfImport`-Komfort), 4.10 (Error-Banner ohne Error-Farbe, Duplikate als Fehler, fehlende Progress Indicators, `role="status"` in `RoomPanel`, Autosave-Feedback), 5.1 (ungeschütztes „Alles aufdecken“ & Löschen + Wiederherstellbarkeit).

### Betroffene Dateien
- **Neu:** `src/renderer/src/Dialog.tsx` (wiederverwendbarer M3-Dialog + `ConfirmDialog` auf Basis von nativem `<dialog>`)
- **Neu:** `src/renderer/src/Feedback.tsx` (M3-Snackbar-Queue mit Aktionsbutton „Rückgängig“ + M3-ProgressBar + M3-ErrorBanner)
- `src/main/library.ts` + `src/main/library.test.ts` (`removeAsset` liefert Trash-Namen, neu: `restoreAsset`)
- `src/main/scenes.ts` + `src/main/scenes.test.ts` (`deleteScene` liefert Trash-Namen für JSON + Fog-PNG, neu: `restoreScene`)
- `src/main/index.ts`, `src/preload/index.ts`, `src/shared/types.ts` (IPC `library:restore`, `scenes:restore`)
- `src/renderer/src/DisplayPicker.tsx`
- `src/renderer/src/AssetPicker.tsx`
- `src/renderer/src/PdfImport.tsx`
- `src/renderer/src/Scenes.tsx`
- `src/renderer/src/Library.tsx`
- `src/renderer/src/SceneEditor.tsx`
- `src/renderer/src/FogPanel.tsx`
- `src/renderer/src/RoomPanel.tsx`
- `src/renderer/src/Settings.tsx`
- `src/renderer/src/tools/rooms.tsx`
- `src/renderer/src/tools/grid.tsx`
- `src/renderer/src/styles.css`

### Konkrete Änderungen
1. **Wiederverwendbare `M3Dialog`-Komponente (`Dialog.tsx`):**
   - Verwendet natives `<dialog>` + `showModal()`: liefert Focus Trap, Top-Layer, `::backdrop`-Scrim (`--scrim`) und `Escape`-Abbruch nativ.
   - Fokus wird beim Öffnen automatisch auf das erste interaktive Element / den Dialog gesetzt und beim Schließen an `document.activeElement` (vor dem Öffnen) zurückgegeben.
   - Klick auf Scrim (`e.target === dialogRef.current`) schließt den Dialog, sofern nicht `busy={true}` (z. B. während PDF-Import).
   - M3-Optik für Bestätigungsdialoge (`ConfirmDialog`): `28px` Radius (`--shape-xl`), `--surface-high`, optionales zentriertes `24px`-Icon oben (`delete` / `warning`), Headline Small (`24px`), klarer Supporting-Text, rechtsbündige M3-Action-Buttons (Text-Button „Abbrechen“ + Filled/Error-Button für destruktive Bestätigung).
   - Größen-Varianten:
     - `size="basic"` (`width: min(560px, 90vw); min-width: 280px`) → für `DisplayPicker` & `ConfirmDialog`.
     - `size="large"` (`width: min(900px, 92vw)`) → für `AssetPicker` & `PdfImport`.
   - `1px solid var(--outline-variant)` Scroll-Divider ober- und unterhalb des scrollbaren Inhaltsbereichs.
2. **Alle nativen `window.confirm()` & `window.alert()` ersetzen + Trash-Undo ergänzen:**
   - `Scenes.tsx:99`, `Library.tsx:169`, `RoomPanel.tsx:68` → `ConfirmDialog` (M3-Oberfläche statt OS-Popup).
   - `DisplayPicker.tsx:21` → Fehler inline im Dialog oder als Error-Banner/Snackbar statt `alert()`.
   - **Neu absichern:**
     - **„Alles aufdecken“** in `FogPanel.tsx:53` → `ConfirmDialog` (*„Gesamte Karte für Spieler aufdecken?“*).
     - **Ebene löschen** (`SceneEditor.tsx:534`): Bestätigungsdialog, sobald die Ebene lokale Raster oder platzierte Flächen besitzt (und zusätzlich über allgemeines Undo in AP 6 sofort rückgängig machbar).
   - **Wiederherstellen aus `data/trash/` nach Bestätigung:**
     - Nach bestätigtem Löschen einer Szene (`deleteScene`) oder eines Assets (`removeAsset`) erscheint eine M3-Snackbar (*„Szene ‚…‘ in den Papierkorb verschoben“* / *„‚…‘ in den Papierkorb verschoben“*) mit **„Rückgängig“**-Button.
     - Klick auf „Rückgängig“ ruft `scenes:restore` (stellt Szene + ggf. `.fog.png` wieder her) bzw. `library:restore` (stellt Asset-Datei wieder her; Thumbnail wird automatisch neu generiert) auf.
     - Unit-Tests in `scenes.test.ts` und `library.test.ts` für den kompletten Delete → Restore-Roundtrip (inkl. Fog-Maske und Namenskollision).
3. **`PdfImport` vervollständigen (`PdfImport.tsx`):**
   - Auf `M3Dialog` umstellen (löst fehlendes `Escape`, Focus Trap & Scrim-Dismiss automatisch; während `progress !== null` wird `busy` gesetzt).
   - Buttons **„Alle auswählen“ / „Auswahl aufheben“** ergänzen.
   - M3 Determinate **Linear Progress Indicator** für Seiten-Voransichten und Import-Fortschritt einbauen.
   - Sichtbares Checkmark-Badge (`check_circle`) auf ausgewählten `.pdf-page`-Karten (nicht nur Farb-/Rahmenänderung).
4. **M3-Error-Banner, M3-Snackbars & Progress Indicators (`Feedback.tsx`):**
   - **Error-Banner (`.errors`):** Hintergrund `--error-container`, Text `--on-error-container`, führendes `error`-Icon, automatische Deduplizierung identischer Fehlermeldungen.
   - **M3-Snackbar:** Floating unten links/mitte (`--inverse-surface`, `--inverse-on-surface`, `--inverse-primary` für den Aktionsbutton, `4px` Radius, Elevation 3, `role="status"`, Schließen-Button + optionaler „Rückgängig“-Button) für nicht-kritische Infos:
     - Wiederherstellungs-Undo nach Szenen-/Asset-Löschen,
     - Duplikat-Hinweise beim Bibliothek-Import (raus aus dem Error-Banner!),
     - „Key gespeichert“ / „Key entfernt“ in `Settings.tsx` (Fehler in `Settings.tsx` hingegen klar im `--error`-Stil!),
     - „Zuschnitt in der Bibliothek gespeichert“.
   - **M3 Progress Indicators:**
     - **Gemini-Raumvorschlag (`RoomPanel.tsx` / `tools/rooms.tsx`):** Indeterminate M3 Linear Progress Bar unter dem Button + klarer Status-Text mit `role="status"` + Abbrechen-Möglichkeit (ignoriert spätes Ergebnis per Request-ID, damit der DM nicht blockiert ist).
     - **Raster-Erkennung (`GridPanel.tsx`):** Indeterminate Linear Progress während `detect()`.
     - **Bibliothek-Thumbnails (`Library.tsx`):** Dezenter Shimmer-/Ladezustand auf `.no-thumb` statt leerem schwarzem Kasten.
   - **Autosave-Status (`SceneEditor.tsx`):** Dezentes Status-Icon/Text („Gespeichert“ / „Speichert…“) in der Scene-Toolbar.
   - `role="status"` in `RoomPanel.tsx:92,105` ergänzen.

### Akzeptanzkriterien & Verifikation
- Kein einziges `window.confirm` oder `window.alert` im gesamten `src/`-Verzeichnis.
- `npm test`: Neue Unit-Tests für `restoreScene` (inkl. `.fog.png`) und `restoreAsset` grün.
- Live-CDP-Test aller Modals: `modalInitialFocus` liegt im Dialog, `escapedModal === false`, `closedByScrim === true`, `Escape` schließt alle Modals, `DisplayPicker`-Breite ≤ `560px`.
- Gelöschte Szene bzw. gelöschtes Asset lässt sich nach dem Bestätigungsdialog per „Rückgängig“-Snackbar 1-Klick-wiederherstellen.

---

## AP 6 – Allgemeines Undo/Redo, Barrierefreiheit (A11y), Shortcuts & Bibliothek (Rename + Referenzen)

**Behebt aus Audit:** 3.2 (Fokus-Clipping in `AssetPicker`, `<summary>`-Fokus), 4.5 (WAI-ARIA-Tab-Pattern, fehlender `AssetPicker`-Tab-Divider, M3-Badges in Bibliothek), 4.8 (Touch-unbedienbarer Hover-Delete, fehlende Suche/Sortierung/Umbenennen/Referenzprüfung, `onDragLeave`-Bug), 4.12 (native `title`-Tooltips), 5.1 (Shortcuts, Trackpad-Pan, Zoom-Buttons, allgemeines Undo/Redo).

### Betroffene Dateien
- **Neu:** `src/renderer/src/useTablist.ts` (WAI-ARIA-Tablist-Hook)
- **Neu:** `src/renderer/src/history.ts` + `src/renderer/src/history.test.ts` (einheitliche Undo/Redo-History für `Scene` + Nebel-Snapshots)
- `src/main/library.ts` + `src/main/library.test.ts` (`renameAsset`)
- `src/main/scenes.ts` + `src/main/scenes.test.ts` (`findAssetReferences`, `renameAssetInScenes`)
- `src/main/index.ts`, `src/preload/index.ts`, `src/shared/types.ts` (IPC `library:references`, `library:rename` + Live-/Editor-Sync)
- `src/renderer/src/controls.tsx` (M3-Tooltip-Wrapper)
- `src/renderer/src/SceneEditor.tsx`
- `src/renderer/src/tools/fog.tsx`
- `src/renderer/src/Library.tsx`
- `src/renderer/src/AssetPicker.tsx`
- `src/renderer/src/styles.css`

### Konkrete Änderungen
1. **Allgemeines Undo / Redo für alle Editor- & Nebel-Aktionen (`history.ts`, `SceneEditor.tsx`, `tools/fog.tsx`):**
   - **Gemeinsame chronologische Timeline** (Ringpuffer, z. B. 50 Schritte) für zwei Eintragstypen:
     - `scene`-Einträge (kompletter `Scene`-Snapshot vor/nach jeder Bearbeitung: Ebenen hinzufügen/entfernen/verschieben/sperren/sichtbar/transformieren/zuschneiden/teilen, Tokens, Raster global & lokal, Räume inkl. Pinsel/Rechteck/Zauberstab/Gemini-Vorschläge, platzierte Flächen, Szenenname, Spieler-Ausschnitt).
     - `fog`-Einträge (PNG-/Canvas-Snapshot vor & nach Pinselstrich, Rechteck, Raum-Aufdecken/Verdecken, Alles verdecken/aufdecken, inkl. `fog.rect`/`enabled`-Stand).
   - **Coalescing:** Kontinuierliche Drag-, Slider-, Pinsel- und Tipp-Änderungen innerhalb eines zusammenhängenden Vorgangs (z. B. `pointerdown` → `pointerup` bzw. kurzes Zeitfenster für Texteingaben) werden als **ein einziger** Undo-Schritt gespeichert.
   - **Sichtbare M3-Controls + Shortcuts:**
     - Zwei M3-Icon-Buttons **Rückgängig (`undo`)** und **Wiederholen (`redo`)** in der Scene-Toolbar (mit `disabled`-State und Tooltip `Rückgängig (Strg+Z)` / `Wiederholen (Strg+Y)`).
     - Tastaturkürzel `Strg+Z` (Undo) und `Strg+Umschalt+Z` / `Strg+Y` (Redo) – außerhalb aktiver Textfelder (damit natives Text-Undo in Inputs erhalten bleibt!).
     - Bei `fog`-Undo wird der vorherige Masken-Stand sofort auf dem DM-Canvas wiederhergestellt und per `saveFog` gespeichert, sodass auch das Live-Spielerfenster unmittelbar aktualisiert wird!
   - Unit-Tests in `src/renderer/src/history.test.ts` (Push, Undo, Redo, Redo-Stack-Clear bei neuer Aktion, Coalescing, Ringpuffer-Limit, gemischte `scene`+`fog`-Timeline).
2. **Bibliothek-Erweiterungen: Suche, Sortierung, Asset-Umbenennen & Szenen-Referenzprüfung (`Library.tsx`, `AssetPicker.tsx`, `src/main/library.ts`, `src/main/scenes.ts`):**
   - **Szenen-Referenzprüfung (`library:references`):**
     - Scannt alle Szenen in `data/scenes/` nach Referenzen auf `(kind, name)` in `layers[]` (`l.kind === kind && l.name === name`), `tokens[]` (`t.kind === kind && t.name === name`) sowie `layers[].areas[]` (`kind === 'effects' && a.asset === name`).
     - Vor dem Öffnen des M3-Lösch-Bestätigungsdialogs in `Library.tsx` werden die betroffenen Szenennamen abgefragt und im Dialog klar hervorgehoben (*„Wird in folgenden Szenen verwendet: …“*), sodass der DM niemals blind eine aktive Karte löscht!
   - **Asset-Umbenennen (`library:rename`):**
     - Neue Aktion „Umbenennen“ (`edit`) auf jeder Bibliothekskachel öffnet einen kompakten `M3Dialog` (`size="basic"`) mit vorausgefülltem Dateistamm (Dateiendung wird geschützt beibehalten; Validierung gegen ungültige Zeichen und bestehende Dateinamen).
     - Im Main-Prozess (serialisiert über die bestehende `serial()`-Queue): benennt Asset-Datei + ggf. `.webp`-Thumbnail um **und** aktualisiert atomar alle Referenzen in sämtlichen gespeicherten Szenen-JSONs (inkl. Live-Push an das Spielerfenster, falls die Live-Szene betroffen war; geöffnete Szene im Renderer wird per Event/Callback ebenfalls aktualisiert!).
     - Nach Umbenennen: M3-Snackbar (*„Umbenannt (X Szenen aktualisiert)“*) mit **„Rückgängig“**-Button (benennt wieder zurück!).
   - **Suche, Sortierung & Touch-Bedienbarkeit:**
     - Kompakte **M3 Search Bar** (Filter nach Dateiname mit Clear-Button) + Sortierung (A–Z / Z–A) in `Library` und `AssetPicker`.
     - **Touch-sichere Kachel-Aktionen:** Statt hover-unsichtbarem Overlay über dem Bild erhalten Kacheln im Footer neben dem Dateinamen sichtbare kompakte Aktions-Icons (`edit` Umbenennen, `delete` Entfernen – oder `more_vert`-Menü) mit mindestens `40×40px` Klickziel.
     - **`onDragLeave`-Zähler-Fix:** `dragDepth` per `useRef(0)` hoch-/runterzählen (`onDragEnter` +1, `onDragLeave` -1, `onDrop` = 0).
   - Unit-Tests in `library.test.ts` & `scenes.test.ts` für `findAssetReferences`, `renameAsset` und `renameAssetInScenes`.
3. **WAI-ARIA-Tab-Pattern & Tab-Feinschliff (`useTablist.ts`, `Library.tsx`, `AssetPicker.tsx`, `SceneEditor.tsx`):**
   - `useTablist` implementiert `ArrowLeft`/`ArrowRight`, `Home`/`End`, Roving `tabIndex` (`0` auf aktivem Tab, `-1` auf inaktiven) sowie `id`/`aria-controls`/`role="tabpanel"`.
   - Primary-Tab-Indikator (`.toolbar` in `Library`): labelbreit mit gerundeten oberen Ecken (`3px 3px 0 0`); Secondary-Tab-Indikator (`.panel-tabs`, `AssetPicker`): vollbreit `2px`; `1px solid var(--outline-variant)` Bottom-Divider auch in `AssetPicker` ergänzen.
   - Zähler in `Library`-Tabs als kleine M3-Badge am Icon/Label statt `· 7` im selben Textknoten.
4. **Fokus-Clipping & Tastatur-Tooltips (`controls.tsx`, `styles.css`):**
   - `.picker .pick:focus-visible` mit `outline-offset: -2px` (oder Fokusrahmen auf `.tile:has(.pick:focus-visible)`) → Fokusring auf allen Kacheln 100 % sichtbar!
   - M3 Plain-Tooltip-Komponente (per CSS `:hover` + `:focus-visible`, `aria-describedby`, `--inverse-surface`, `4px` Radius, schließbar per `Escape`) für alle Icon-Buttons statt nativem `title`.
5. **Editor-Shortcuts & Trackpad-Ergonomie (`SceneEditor.tsx`):**
   - Globaler `keydown`-Handler im aktiven `SceneEditor` (ignoriert Events, wenn `input`/`textarea`/`select` fokussiert sind – außer `Escape`!):
     - `Escape`: beendet Framing → sonst aktives Tool (`exclusive()`) → sonst Auswahl aufheben (`setSelectedId(null)`).
     - `Space` (gedrückt halten): temporärer Pan-Modus (Cursor `grab`/`grabbing`), funktioniert auch bei aktivem Nebel-/Raum-/Mess-Werkzeug → volle Laptop-Trackpad-Bedienbarkeit!
     - `+` / `=` und `-`: Zoom In / Zoom Out um Stage-Mitte; `0`: Einpassen (`fit()`).
     - `Delete` / `Backspace` (außerhalb von Inputs): ausgewähltes Token/Ebene löschen (mit Schutzlogik + Undo).

### Akzeptanzkriterien & Verifikation
- `npm test`: Grüne Unit-Tests für `history.ts`, `NumberField`, `findAssetReferences`, `renameAsset`, `renameAssetInScenes`.
- Live-CDP-Test: `ArrowRight` wechselt Tabs in `Library`/`AssetPicker`/`Panel`; `Escape` beendet Framing und Werkzeuge; `AssetPicker`-Fokusring ist visuell sichtbar; `Ctrl+Z` & Toolbar-Buttons machen Ebenen-/Token-/Raum-/Nebel-Aktionen rückgängig & wiederholen sie; Asset umbenennen aktualisiert Referenzen in offenen & gespeicherten Szenen.

---

## AP 7 – Terminologie, Empty States & Automatisierte UI-Verifikation

**Behebt aus Audit:** 4.11 (Empty States, Szenen-Sortierung nach Umbenennung), 5.2 (Sprach-/Begriffskonsistenz, unsichtbare zitierte Button-Texte, `aistudio.google.com`).

### Betroffene Dateien
- `src/renderer/src/Scenes.tsx`
- `src/renderer/src/SceneEditor.tsx`
- `src/renderer/src/FogPanel.tsx`
- `src/renderer/src/RoomPanel.tsx`
- `src/renderer/src/Settings.tsx`
- `src/renderer/src/tools/fog.tsx`
- `src/renderer/src/tools/rooms.tsx`

### Konkrete Änderungen
1. **Einheitliche deutsche Terminologie durchgängig anwenden:**
   - Überall **„Nebel“** statt gemischtem `Fog` / `Fog of War` (z. B. „Nebel aktiv“, „Nebel-Bereich“, „Erst Nebel aktivieren“, „Aufdecken braucht aktiven Nebel“).
   - Überall **„Karte“** statt `Map` (`Settings.tsx:30`, `RoomPanel.tsx:99`, `tools/rooms.tsx:43`).
   - Überall **„Bildschirm“** statt `Display` (falls noch vorhanden).
2. **Klare Empty States mit direkter Handlungsaufforderung (CTA):**
   - `Scenes.tsx` (keine Szene gewählt): Zentrierte M3-Empty-State-Card auf `--surface-low` mit `map`-Icon, klarem Text (*„Wähle eine Szene aus oder lege eine neue an.“*) und direktem Filled-Tonal-Button **„Neue Szene anlegen“** (kein Verweis mehr auf unsichtbares „links“ oder unbeschriftetes `+`).
   - `Scenes.tsx` (0 Szenen in der Liste): Hinweis + Button auch in der Szenenliste.
   - `SceneEditor.tsx` (0 Ebenen auf der Stage): Zentrierter Empty State mit direktem Button **„Karte / Ebene hinzufügen“** statt reinem Textverweis auf das unbeschriftete Icon.
   - `Scenes.tsx:76`: Nach Umbenennen einer Szene die Liste direkt alphabetisch neu sortieren (`localeCompare`), konsistent mit `listScenes`.
3. **Einstellungen-Feinschliff (`Settings.tsx`):**
   - Hinweis zu `aistudio.google.com` klar formatiert mit sicherem Kopier-Button (oder externem Link).
4. **Reproduzierbare Abschluss-Verifikation (Dark & Light Theme):**
   - `npm run typecheck`, `npm test`, `npm run build` ausführen.
   - Live-Electron-Prüflauf analog zu Abschnitt 6 in `UI_UX_M3_AUDIT.md` in **Dark und Light Theme** wiederholen (`1280×800`, `1024×600`, `960×600`, `24px`-Textskalierung, Tab-Order, Focus Trap, `NumberField`, `Escape`, Undo/Redo, Trash-Restore, Asset-Rename + Referenzen, State-Erhalt) und alle Vorher-Fails auf **Pass** verifizieren.
