# Bellavellum – UI/UX-Audit & Material-3-Vergleich

> **Prüfungsbasis:**
> 1. **Statische Vollprüfung** aller Renderer-Komponenten (`src/renderer/src/**/*.tsx`), Styles (`src/renderer/src/styles.css`), HTML (`src/renderer/index.html`), Electron-Fensterkonfiguration (`src/main/index.ts`), Typen (`src/shared/types.ts`), des installierten `material-symbols`-Fonts (`v0.49.0`) sowie WCAG-2.1-Kontrastberechnungen.
> 2. **Live-UI/UX-Prüfung in gestarteter Electron-Instanz (Chromium/CDP):** 18 visuelle Screenshots aller Views, Tabs, Zustände, Modals, Fenstergrößen (`1280×800`, `1024×600`, `960×500`) und Textskalierung (`24px` Root), inkl. interaktiver Tastatur-, Fokus-, Eingabe- und Geometrie-Messungen mit realen Projektdaten (Szene + 7 Karten + Hochformat-Zweitmonitor `1080×1920`).
> **Referenz:** Google Material Design 3 Guidelines (`m3.material.io`, inkl. aktueller M3-Spezifikationen für Surface Containers, State Layers, Sliders, Floating Toolbars, Connected Button Groups, Type Scale & Accessibility).
> **Technischer Projektzustand:** `npm run typecheck` fehlerfrei; `npm test` 81/81 Tests bestanden; 0 Konsolen- oder Laufzeitfehler in der gestarteten Electron-Instanz. *(Nicht live getestet: PDF-Import mit echter PDF-Datei, echter Gemini-API-Call, Screenreader NVDA/VoiceOver, Linux/AppImage & HiDPI-Skalierung > 100 %.)*

---

## 1. Gesamteindruck

Bellavellum besitzt bereits ein erkennbares und durchdachtes **Material-3-Grundgerüst** (Commit `4d4de95`):
- **Stärken:**
  - Ein aus dem Gold-Seed (`#c9a45c`) abgeleitetes Dark-Theme mit sauberer Tonal-Abstufung (`--surface` bis `--surface-highest`) und sehr guten Basiskontrasten (überwiegend WCAG AAA für Text auf Surfaces).
  - Korrekte Grundstrukturen bei Navigation Rail (`80px` breit, `56×32px` Active-Indicator-Pill mit `FILL 1`), Switches (`52×32px`, `16px → 24px` Handle), aktualisiertem M3-Slider-Profil (`16px` Track, `4px` vertikaler Handle), Button-Varianten (Filled, Tonal, Outlined, Text, Icon) und lokal gebündelten Fonts (`Roboto` + `Material Symbols Rounded`).
  - Gute funktionale Trennung von DM-Editor und ablenkungsfreiem Spielerfenster.

- **Zentrale Schwachstellen:**
  1. **Layout-Überläufe & Positionierungs-Hacks:** Auf dem Standardfenster (`1280×800`) überlaufen die Floating Toolbars die ~`520px` breite Stage und werden abgeschnitten; FAB und Blackout-Button nutzen fragiles `position: fixed`, was Tab-Reihenfolge, Short-Viewport-Layouts und die Erreichbarkeit von „Ausblenden“ bricht.
  2. **Kritische Zustands- & Kontrastfehler:** Der aktive **Live**-Button wird über `:disabled` auf `opacity: 0.38` gedimmt (Kontrast kollabiert auf `2.61:1`), gesperrte Buttons im `fieldset` auf `0.19` (`1.55:1`); eigentliche Fehlerbanner nutzen kein Error-Styling, während „Live“ die Error-Rolle belegt.
  3. **Fehlende M3-Interaktionsschicht:** Keine echten State Layers (`filter: brightness(1.12)` statt Content-Color-Overlays), keinerlei `:active`/Pressed-States, quasi keine M3-Motion, kein `prefers-reduced-motion`, native `window.confirm()`/`window.alert()` und native `title`-Tooltips.
  4. **Barrierefreiheit & Desktop-UX-Lücken:** Keine Focus Traps in Modals, fehlendes WAI-ARIA-Tab-Keyboard-Handling, nahezu keine Tastaturkürzel (nicht einmal `Escape` für Werkzeuge/Framing/PDF-Import oder `Ctrl+Z`/Undo), State-Verlust beim Wechsel zwischen Hauptbereichen (`Szenen` ↔ `Bibliothek` ↔ `Einstellungen`) sowie mehrere konkrete Bedienbugs (`NumberField`, Area-Effekt-`<select>`, falscher „Schere-Werkzeug“-Hinweis).

---

## 2. Priorisierte Übersicht der wichtigsten Befunde

| Prio | Bereich | Befund | Fundstelle |
| :--- | :--- | :--- | :--- |
| **Kritisch** | Layout / Toolbar | Floating Toolbar überläuft & klippt **live verifiziert** im Standardfenster (`1280×800`, Stage `520px`): `Räume` (`593px`, `±36px` Clip), `Ebenen/Teilen` (`601px`, `±40px` Clip), `Nebel` (`479px`, überlappt `.zoom`); bei `1024×600` & `960×500` Kollision zwischen `.side-tools`, `.stage-help` und `.floating-tools` | `src/main/index.ts:87`, `src/renderer/src/styles.css:979-1063`, `src/renderer/src/tools/rooms.tsx:191-228` |
| **Kritisch** | UX / Framing | **Live-Befund:** Im Framing-Modus („Ausschnitt für Spieler“) wird der gelbe Hinweis oben abgeschnitten, kollidiert mit `.stage-help`, und die untere Floating Toolbar bleibt über der Maske sichtbar & aktiv | `src/renderer/src/SceneEditor.tsx:430-437`, `src/renderer/src/styles.css:785-805` |
| **Kritisch** | UX / State | Wechsel von `Szenen` zu `Bibliothek`/`Einstellungen` unmountet `Scenes` & `SceneEditor` → offene Szene schließt, Kamera/Auswahl/laufender Gemini-Call gehen verloren (**live verifiziert**) | `src/renderer/src/main.tsx:65` |
| **Kritisch** | UX / Live-Sicherheit | „Ausblenden“ (Blackout) verschwindet komplett in `Bibliothek`/`Einstellungen` (**live verifiziert**); zudem kollidiert `position: fixed; bottom: 150px` auf niedrigen Fenstern (`< ~530px` Außenhöhe) | `src/renderer/src/Scenes.tsx:109-114`, `src/renderer/src/styles.css:398-404` |
| **Kritisch** | UX / Destruktiv | „Alles aufdecken“ (Nebel) sowie Löschen von Ebenen (inkl. lokaler Raster/Flächen), Tokens, Flächen und lokalen Rastern erfolgen per Einzelklick **ohne Bestätigung & ohne Undo**; Delete-Icon nur `32×32px` (`4px` neben Verschieben) | `src/renderer/src/FogPanel.tsx:52-53`, `src/renderer/src/SceneEditor.tsx:534,559,619`, `src/renderer/src/styles.css:895-898` |
| **Kritisch** | Farbe / Kontrast | Aktiver `Live`-Button (`disabled={isLive}`) erbt `opacity: 0.38` → Kontrast fällt von `7.24:1` auf `2.61:1` (Container `1.16:1`), wirkt inaktiv statt aktiv (**live verifiziert**) | `src/renderer/src/SceneEditor.tsx:394`, `src/renderer/src/styles.css:78-81,96-99` |
| **Hoch** | UX / Input-Bug | `NumberField` blockiert Leeren des Felds und das Eintippen von Zahlen `< min` als Präfix (`29.29` bleibt nach `Backspace` & Tippen von `1` unverändert – **live verifiziert**) | `src/renderer/src/controls.tsx:58-62` |
| **Hoch** | UX / Input-Bug | Bei Flächen-Effekt lässt sich nach Wahl einer Datei (`value="asset"`) keine neue Datei direkt über „Datei …“ auswählen (`onChange` feuert nicht) | `src/renderer/src/SceneEditor.tsx:570-586` |
| **Hoch** | UX / Copy-Bug | Zuschneiden-Hinweis nennt das „Schere-Werkzeug“ (`content_cut` = **Teilen**!), nicht Zuschneiden (`crop`) → Nutzer teilen versehentlich ihre Karte | `src/renderer/src/LayerProps.tsx:78`, `src/renderer/src/tools/layerEdit.tsx:76,91` |
| **Hoch** | A11y / Modals | Keine Focus Traps (`escapedModal: true`), kein Auto-Focus (`modalInitialFocus: icon-btn`), kein Scrim-Dismiss (**live verifiziert**); `PdfImport` fehlt `Escape`; 4× native `confirm()`/`alert()` | `src/renderer/src/DisplayPicker.tsx`, `AssetPicker.tsx`, `PdfImport.tsx`, `Scenes.tsx:99`, `Library.tsx:169`, `RoomPanel.tsx:68` |
| **Hoch** | A11y / Focus & Text | Fokusreihenfolge springt per Tab von `Einstellungen` (y:669) zurück zum FAB (y:72); Fokusring in `AssetPicker` komplett unsichtbar (`.tile { overflow: hidden }`); Textskalierung (`24px`) schneidet `.panel-tabs` (`"Rä"`) ab (**live verifiziert**) | `src/renderer/src/main.tsx:44`, `Scenes.tsx:82`, `styles.css:141-152,576,1250` |
| **Hoch** | M3 States | `filter: brightness(1.12)` statt M3 State Layers; 0 `:active`-States; unselected `.segmented`-Buttons haben keinen Hover-Effekt; keine Hover-States auf Switches/Sliders/TextFields | `src/renderer/src/styles.css:74-76,121-127,310-330` |
| **Hoch** | UX / Tastatur | Keine Shortcuts (`Escape` beendet weder Tools noch Framing, `Ctrl+Z`, `Space`-Pan für Trackpads, `+`/`-` Zoom); fehlende Pfeiltasten-Navigation in allen `tablist`s (**live verifiziert**) | `src/renderer/src/SceneEditor.tsx`, `main.tsx`, `Library.tsx`, `AssetPicker.tsx` |
| **Hoch** | Feedback | Keine M3 Progress Indicators trotz mehrminütigem Gemini-Call, PDF-Rendering & Grid-Erkennung; Fehlerbanner ohne Error-Farbe/-Icon | `src/renderer/src/styles.css:419-427`, `tools/rooms.tsx:41-65`, `PdfImport.tsx:71,83` |
| **Mittel** | Visual / Karte | **Live-Befund:** Raum-Labels überlappen sich unleserlich auf der Karte (`"KojVorratskaArrestzelle"`), liegen dauerhaft über allen Tabs (`showRooms` default `true`) und werden unten von der Toolbar verdeckt | `src/renderer/src/SceneView.tsx:347-352`, `src/renderer/src/tools/rooms.tsx:27` |
| **Mittel** | Visual / Liste | **Live-Befund:** `.layer-name` schneidet Dateinamen ohne `…` (Ellipsis) hart ab (`display: inline-flex` bricht `text-overflow: ellipsis`); `.area-row` ohne Form-Icon & vertikalen Abstand | `src/renderer/src/SceneEditor.tsx:507,542-588`, `src/renderer/src/styles.css:67,870-883` |
| **Mittel** | M3 Slider | Fake-Gap `box-shadow: 0 0 0 4px var(--surface-low)` erzeugt sichtbaren dunklen Kasten in `.props` (`--surface-container`, **live verifiziert**); `NaN%`-Edge-Case; kein Centered Slider für Drehung | `src/renderer/src/styles.css:278,1290`, `src/renderer/src/controls.tsx:34` |
| **Mittel** | M3 Typografie | Keine M3 Type-Scale-Tokens, keine `line-height`-Definitionen, fehlendes Tracking, nicht geladenes `Roboto 600` (**live bestätigt**), inkonsistente Schriftgrößen im Panel, fixe `px` verhindern Textskalierung | `src/renderer/src/main.tsx:3-4`, `src/renderer/src/styles.css:4-5,209,1158,1314,1392` |
| **Mittel** | M3 Touch/Targets | Hover-only Delete-Button auf Bibliothekskacheln (`opacity: 0`) auf Touch/Stift unsichtbar; `32×32px` Listen-Buttons und `16px` Slider-Track deutlich unter M3 `48dp` | `src/renderer/src/styles.css:260,596-607,895-898` |
| **Mittel** | M3 Konsistenz | 3 verschiedene Input-Stile; `.primary` mit 3 Bedeutungen überladen; englische Electron-Menüleiste kostet `65px` Höhe (`outerHeight 800 → innerHeight 735`); Spielerfenster verliert seinen Titel (`Bellavellum` statt `Bellavellum – Spieler`) | `src/renderer/src/styles.css:91,740,1200`, `src/main/index.ts:66,87`, `src/renderer/index.html:6` |
| **Niedrig** | M3 Ikonografie | Variable Font-Achsen (`opsz`, `GRAD -25` für Dark Theme) ungenutzt; 4 Legacy-Alias-Namen (`auto_awesome`, `file_upload`, `highlight_alt`, `push_pin`); Icon-Kollisionen | `src/renderer/src/styles.css:41-54`, `Library.tsx:8,177`, `tools/grid.tsx:209,218`, `tools/measure.tsx:118` |

---

## 3. Material 3 Foundations

### 3.1 Farbsystem, Tokens & Kontraste (`src/renderer/src/styles.css:1-27`)

#### Gemessene Kontrastwerte (WCAG 2.1)
| Kombination | Hex-Werte | Kontrast | Bewertung |
| :--- | :--- | :---: | :--- |
| `--on-surface` auf `--surface` … `--surface-highest` | `#ebe1d4` auf `#17130b` … `#39342b` | `14.33:1` – `9.56:1` | **AAA** |
| `--on-surface-variant` auf `--surface` … `--surface-highest` | `#d0c5b4` auf `#17130b` … `#39342b` | `10.87:1` – `7.25:1` | **AAA** |
| `--primary` auf `--surface` … `--surface-highest` | `#e9c16c` auf `#17130b` … `#39342b` | `10.85:1` – `7.24:1` | **AAA** |
| `--on-primary` auf `--primary` | `#3f2e00` auf `#e9c16c` | `7.68:1` | **AAA** |
| `--on-primary-container` auf `--primary-container` | `#ffdf9e` auf `#5b4300` | `7.25:1` | **AAA** |
| `--on-secondary-container` auf `--secondary-container` | `#f3e0bb` auf `#4f4530` | `7.27:1` | **AAA** |
| `--on-error-container` auf `--error-container` | `#ffdad6` auf `#93000a` | `7.24:1` | **AAA** |
| `--outline` auf `--surface-low` / `--surface-highest` | `#998f80` auf `#1f1b13` / `#39342b` | `5.39:1` / `3.88:1` | **AA** / **AA-UI** |
| `--outline-variant` auf `--surface-low` / `--surface-high` | `#4d4639` auf `#1f1b13` / `#2e2921` | **`1.84:1` / `1.55:1`** | **FAIL (< 3:1 UI)** |
| `button.live:disabled` (kompositiert mit `opacity: 0.38` auf `--surface`) | `#ffdad6` / `#93000a` @ 38% auf `#17130b` | **`2.61:1`** (Container **`1.16:1`**) | **FAIL** |
| `fieldset.plain:disabled button:disabled` (`0.5 × 0.38 = 0.19` auf `--surface-container`) | `#f3e0bb` / `#4f4530` @ 19% auf `#231f17` | **`1.55:1`** | **FAIL** |

#### Abweichungen von Material 3
1. **Unvollständiges M3-Token-Set & ungenutzte Tokens:**
   - `--tertiary` (`#aecfa6`, `styles.css:12`) ist definiert, wird aber **0-mal** verwendet.
   - Es fehlen zentrale M3-Rollen: `--secondary`, `--on-secondary`, `--on-tertiary`, `--tertiary-container`, `--on-tertiary-container`, `--on-error`, `--surface-container-lowest`, `--surface-dim`, `--surface-bright`, `--inverse-surface`, `--inverse-on-surface`, `--inverse-primary` sowie `--scrim`.
   - Da `--inverse-surface` / `--inverse-on-surface` fehlen, gibt es keine echten M3-Snackbars oder Plain-Tooltips.
2. **Invertierte Error-Semantik:**
   - `--error` und `--error-container` werden für den **Normal-/Aktivzustand „LIVE“** (`button.live`, `.live-badge`) und „Ausblenden“ (`.blackout`) verwendet, während **tatsächliche Fehlermeldungen** (`.errors`, `styles.css:419-427`, sowie Fehlertext in `Settings.tsx:19,64`) **keinerlei Error-Farbe** nutzen (`--surface-highest` + `--on-surface`). In M3 gehört Error konsequent zu Fehlern/destruktiven Warnungen; „Live“ sollte idealerweise eine eigene semantische Statusrolle (oder mindestens ein nicht-gedimmtes Status-Badge) erhalten und Fehler sollten klar `--error-container`/`--on-error-container` nutzen.
3. **`button.live:disabled` Kontrastkollaps (`SceneEditor.tsx:394`):**
   - `disabled={isLive}` aktiviert `button:disabled { opacity: 0.38 }` (`styles.css:78-81`). Ausgerechnet wenn die Szene live ist, wirkt der „Live“-Button ausgegraut und bricht auf `2.61:1` Kontrast ein.
4. **Disabled-Darstellung widerspricht M3 + Doppel-Opacity im `fieldset`:**
   - M3 schreibt für deaktivierte Container `12%` `--on-surface` und für Label/Icon `38%` `--on-surface` vor – nicht `opacity: 0.38` auf das gesamte Element.
   - In `LayerProps.tsx:46-53` addiert sich `fieldset.plain:disabled { opacity: 0.5 }` (`styles.css:1300`) mit `button:disabled { opacity: 0.38 }` zu `0.19` Opacity („90° drehen“ wird nahezu unsichtbar).
5. **`--outline-variant` auf interaktiven Grenzen (WCAG 1.4.11 Fail):**
   - M3 erlaubt `outline-variant` nur für rein dekorative Trennlinien, nicht für funktionale Grenzen. `.drop-card` (`styles.css:617`, `1.84:1`) und nicht ausgewählte `.pdf-page`-Karten (`styles.css:696`, `1.55:1`) nutzen `--outline-variant` als einzigen sichtbaren Rahmen.
6. **Hardcoded Farben statt Tokens:**
   - Zahlreiche feste Farbwerte außerhalb `:root`: `rgb(23 19 11 / 0.8)` (`styles.css:600,973,1470`), `rgb(0 0 0 / 0.6)` und `0.65` (`styles.css:646,791` – M3 Scrim-Standard ist `32%`, zudem inkonsistent zwischen `0.6` und `0.65`), `rgb(233 193 108 / 0.15)` (`styles.css:1140`) vs. `rgb(201 164 92 / 0.15)` (`tools/rooms.tsx:175` – alter Seed-Wert statt `--primary`!), `#ff3b30` (`styles.css:1427`, `tools/grid.tsx:14`), `#ffd24a` (`styles.css:1405`), `#ffb35c` (`styles.css:1380,1384`).
7. **Kein Light Theme / keine Theme-Umschaltung:**
   - `color-scheme: dark` ist fest kodiert (`styles.css:3`). Für eine abgedunkelte Spielrunde ist Dark-First sinnvoll, M3 sieht aber prinzipiell Light/Dark-Unterstützung vor (und zumindest konsistente Dark-Palette für native Controls: `<option>` wird nur in `.room-chip option` (`styles.css:1061`) gestylt, nicht für alle anderen `<select>`-Elemente).

---

### 3.2 State Layers & Interaktionszustände (`src/renderer/src/styles.css`)

1. **`filter: brightness(1.12)` statt M3 State Layers (`styles.css:74-76`):**
   - M3 definiert halbtransparente State Layers in der jeweiligen **Content-Farbe (`on-*`)**: Hover `8%`, Focus `10%`, Pressed `10%` (früher `12%`), Dragged `16%`.
   - `filter: brightness(1.12)` hellt helle Filled Buttons (`--primary: #e9c16c`) falsch auf (statt sie mit 8% dunklem `--on-primary` leicht abzudunkeln) und verfälscht Icon-/Textfarben.
   - Wo `--hover` (`rgb(235 225 212 / 0.08)`) genutzt wird, nutzt es pauschal `--on-surface` statt der jeweiligen Content-Farbe (z. B. `--primary` bei Outlined/Text-Buttons und aktiven Tabs).
2. **Keinerlei `:active` (Pressed) State & kein Ripple:**
   - In den gesamten 1.488 Zeilen CSS existiert **kein einziger `:active`-Selektor**. Klicks auf Buttons, Tabs, Rail-Items, Listenpunkte, Switches oder Kacheln erzeugen kein visuelles Druck-Feedback.
3. **Kaputte oder fehlende Hover-States:**
   - **Unselected `.segmented button` (`styles.css:310-316`):** Hat `background: none`, ist aber **nicht** in der Override-Liste (`styles.css:121-127`) aufgeführt → erbt `filter: brightness(1.12)` auf transparentem Hintergrund = **kein sichtbarer Hover-Effekt** (betrifft z. B. „Ganze Szene“ / „Ausschnitt“ in `SceneEditor.tsx:374-392`).
   - **Pressed `.floating-tools .segmented button[aria-pressed='true']` (`styles.css:1041`):** Überschreibt `.floating-tools button:hover` (`styles.css:1001`) in der Kaskade → kein Hover-Feedback auf dem aktiven Segment.
   - **Keine Hover-States** bei Switches (`.check input`), Sliders (`input[type='range']`), Text Fields (`.text-field`), PDF-Seitenkarten (`.pdf-page`), bereits ausgewählten Listenpunkten (`.scene-list li.selected`, `.layers li.selected`) und nativen `<select>`/`<input>`.
   - **`.picker .pick` (`styles.css:1328-1338`):** Erbt als `<button>` `filter: brightness(1.12)`, wodurch das Vorschaubild überbelichtet wird, statt ein M3-Card-State-Layer anzuzeigen.
4. **Fokus-Indikatoren (`styles.css:83-89`):**
   - M3 empfiehlt `3dp` Stärke, `2dp` Offset; Bellavellum nutzt `2px solid var(--primary)` mit `2px` Offset (gut sichtbar, aber leicht dünner als M3-Spec).
   - **Clipping-Bug in `AssetPicker`:** `.tile` setzt `overflow: hidden` (`styles.css:576`), sodass `outline-offset: 2px` auf `.picker .pick:focus-visible` rundherum **abgeschnitten** wird.
   - **Fehlender Fokus-Style für `<summary>`:** `<details className="preview"><summary>` (`SceneEditor.tsx:485`) fehlt in der `:focus-visible`-Regel (`styles.css:83-86`) und fällt auf den Browser-Standard zurück.
   - **Rail-Fokus:** `.rail-item:focus-visible` legt einen eckigen Rahmen um den schmalen Button statt um die `56×32px`-Pill oder volle Rail-Breite.

---

### 3.3 Typografie (`src/renderer/src/main.tsx:3-4`, `src/renderer/src/styles.css`)

1. **Keine M3-Type-Scale-Tokens & fehlende `line-height` / `tracking`:**
   - Im gesamten CSS gibt es **keine einzige `line-height`-Angabe** außer `.icon { line-height: 1; }`. Der Browser-Default (~`1.18–1.2`) ist enger als die M3-Vorgaben (z. B. Body Medium `14px / 20px` = `1.43`, Body Small `12px / 16px` = `1.33`, Headline Medium `28px / 36px` = `1.29`). Mehrzeilige Hinweise (`.hint`, `.settings-intro`) wirken dadurch vertikal gedrängt.
   - `letter-spacing` (M3 Tracking) fehlt fast überall (vorhanden nur auf `button`, `.settings-section`, `.panel h3`; fehlt bei Body Large `0.5px`, Body Medium `0.25px`, Body Small `0.4px`, Title Medium `0.15px`, Label Medium `0.5px` auf `.rail-item`/`.zoom`/`.stage-help`).
2. **Nicht geladener Font-Weight `600` (Faux-Bold):**
   - `main.tsx:3-4` importiert ausschließlich `@fontsource/roboto/400.css` und `@fontsource/roboto/500.css`.
   - `styles.css:1158` (`.room-label`) und `styles.css:1392` (`.area-label`) nutzen dennoch `font-weight: 600` → Chromium synthetisiert Faux-Bold oder fällt zurück. Die M3-Basis-Skala nutzt zudem nur `400` und `500` (Emphasized-Varianten erfordern das Laden der echten Gewichte).
3. **Inkonsistente typografische Hierarchie im Inspector-Panel:**
   - `.check` (`styles.css:209`, Switch-Labels wie „Raster anzeigen“) ist `16px` (Body Large), während `.panel h3` (Abschnittsüberschriften wie „Zuschneiden“, „Kalibrieren“, `styles.css:1278`) nur `12px` (Label Medium) und `.prop`-Labels (`styles.css:1314`) ebenfalls `12px` sind. Dadurch erscheinen einfache Schalter deutlich dominanter als Abschnittsüberschriften; zudem sind `.settings-section`-Überschriften (`14px`, `--primary`, Title Small) anders gestylt als `.panel h3` (`12px`, `--on-surface-variant`).

---

### 3.4 Shape & Elevation (`src/renderer/src/styles.css`)

1. **Keine Shape-Scale-Tokens & uneinheitliche Radien:**
   - M3 definiert `none (0)`, `extra-small (4px)`, `small (8px)`, `medium (12px)`, `large (16px)`, `extra-large (28px)`, `full (9999px)`.
   - Abweichungen im Projekt:
     - `.live-badge` (`styles.css:903`) nutzt `10px` (kein M3-Token; M3-Badges nutzen `full`/`9999px`).
     - `button` (`styles.css:64`) nutzt `20px` statt `9999px`. Bei mehrzeiligen Buttons (z. B. „Lokales Raster auf ausgewählter Ebene“ in `tools/grid.tsx:249` im `360px`-Panel) geht die volle Pill-Form verloren.
     - `.tool-grid button` (`styles.css:1197`) überschreibt Buttons auf `12px` direkt neben `20px`-Pill-Buttons im selben Panel (`GridPanel.tsx`, `FogPanel.tsx`, `tools/grid.tsx`).
     - `.floating-tools` (`28px` Außenradius, `8px` Padding) enthält Buttons mit `16px` Radius (`styles.css:996`), `.room-chip` mit `8px` (`styles.css:1055`) und `.segmented` mit `20px` (`styles.css:1034`). Nach Konzentrik-Regel wäre `28 - 8 = 20px` (bzw. `full` Kreisbuttons in M3 Floating Toolbar mit `12px` Morph im selektierten Zustand).
2. **Elevation-Abweichungen:**
   - Nur ein einziger Schatten-Token (`--shadow: 0 4px 12px rgb(0 0 0 / 0.45)`) ohne M3-Zwei-Schicht-Schatten (Key + Ambient) und ohne Unterscheidung der Elevation-Stufen 1–5.
   - **FAB in der Navigation Rail (`styles.css:151`):** Nach M3 Navigation-Rail-Spec hat ein in die Rail eingebetteter FAB **Elevation Level 0 (keinen Schatten)**, da er nicht über scrollendem Inhalt schwebt.

---

### 3.5 Motion & Transitions (`src/renderer/src/styles.css`)

1. **Kein M3-Motion-System:**
   - In 1.488 Zeilen CSS existiert nur **eine einzige Transition** (`transition: all 0.15s` in `.check input::after`, `styles.css:236`) und **eine Keyframe-Animation** (`.ping`, `styles.css:1412`).
   - `transition: all 0.15s` nutzt lineares/default `ease` statt M3 Emphasized/Standard Easing (`cubic-bezier`) und animiert pauschal `all`.
   - Abruptes Springen ohne Übergang bei: Szenenliste auf/zuklappen, Dialogen (kein Scrim-Fade, kein Container-Enter/Exit), Navigation-Rail Active-Indicator-Pill (M3 animiert die Pill-Expansion), Tab-Wechsel, Hover-Einblendung von `.tile .remove`, `<details className="preview">` und Kontextwechsel der Floating Toolbar.
2. **Fehlende `prefers-reduced-motion`-Unterstützung:**
   - Weder `.ping` (`styles.css:1408`) noch `.check input::after` noch die animierten SVG-`<feTurbulence><animate>`-Effekte (`SceneView.tsx:184-189`) respektieren `@media (prefers-reduced-motion: reduce)`.

---

### 3.6 Ikonografie / Material Symbols (`src/renderer/src/controls.tsx`, `styles.css:41-54`)

1. **Variable-Font-Achsen ungenutzt:**
   - `material-symbols/rounded.css` liefert den vollen variablen Font, `.icon` setzt aber nur `font-variation-settings: 'FILL' 0`.
   - Es fehlt `'GRAD' -25` (Google-Empfehlung für **Dark Themes**, damit Icons auf dunklem Grund optisch nicht überstrahlen/zu fett wirken) sowie dynamisches `'opsz'` für die 4 genutzten Größen (`18px`, `20px`, `24px`, `36px`).
2. **Inkonsistentes `FILL 1` bei aktiven Zuständen:**
   - Rail-Items und Library-Tabs schalten bei Aktivität sauber auf `'FILL' 1` (`styles.css:416,558`).
   - Aktive Toggle-Buttons in `.floating-tools button[aria-pressed='true']`, `.segmented button[aria-pressed='true']` und `button.icon-btn[aria-pressed='true']` behalten hingegen `'FILL' 0`.
3. **4 Legacy-Alias-Namen (funktional im Font, aber nicht kanonisch):**
   - Ein Check gegen den gebündelten Font (`material-symbols-rounded.woff2`, 4.319 GSUB-Ligaturen) bestätigt: **Alle 47 verwendeten Icon-Namen rendern derzeit korrekt.**
   - Allerdings fehlen 4 Namen in `material-symbols/index.d.ts` (3.945 kanonische Material-Symbols-Namen) und funktionieren nur über Legacy-Material-Icons-Aliase:
     - `auto_awesome` (`Library.tsx:8`, `RoomPanel.tsx:102`, `tools/grid.tsx:218`)
     - `file_upload` (`Library.tsx:177` – kanonisch: `upload_file` oder `upload`)
     - `highlight_alt` (`tools/grid.tsx:209` – kanonisch z. B. `select` / `lasso_select`)
     - `push_pin` (`tools/measure.tsx:118` – kanonisch: `keep`)
   - Zudem ist `Icon({ name: string })` nicht gegen den Typ aus `material-symbols` getypt.
4. **Semantische Icon-Kollisionen:**
   - `auto_awesome` steht für **3 verschiedene Funktionen**: Kategorie „Effekte“ (`Library.tsx:8`), lokale/globale „Raster erkennen“-Automatik (`tools/grid.tsx:218`) und „Räume vorschlagen“ via Gemini (`RoomPanel.tsx:102`).
   - `crop` erscheint **gleichzeitig zweimal auf dem Editor-Screen** mit völlig unterschiedlicher Bedeutung: „Ausschnitt für Spieler“ oben (`SceneEditor.tsx:390`) und „Ebene zuschneiden“ unten (`tools/layerEdit.tsx:76`).
   - `straighten` steht sowohl für „Kalibrieren“ (`tools/grid.tsx:221`) als auch für „Nur messen“ (`tools/measure.tsx:115`).
   - `upload` (Library-FAB) und `file_upload` (Library-Drop-Card) führen dieselbe Aktion mit unterschiedlichen Icons aus.
   - `visibility_off` steht für Blackout, Fog-Verdecken, ausgeblendete Ebenen/Tokens und nur-DM-sichtbare Flächen.

---

## 4. Material 3 Komponenten im Detail

### 4.1 Navigation Rail & FAB (`main.tsx:33-64`, `Scenes.tsx:82-84,109-114`, `Library.tsx:124-131`, `styles.css:141-156,343-417`)

- **Positiv:** `80px` Breite, `56×32px` Active-Indicator-Pill (`border-radius: 16px`), `--secondary-container`-Füllung und `FILL 1`-Icon entsprechen der M3 Collapsed Navigation Rail.
- **Befunde:**
  1. **`position: fixed`-FAB bricht Tab-Reihenfolge & hinterlässt Lücke:** `.fab-slot` (`main.tsx:44`) reserviert Platz in `<nav className="rail">`, während `<button className="fab">` von `Scenes`/`Library` außerhalb der `<nav>` mit `position: fixed; left: 12px; top: 72px;` darübergelegt wird.
     - Die Tastatur-Tab-Reihenfolge springt von der Rail-Unterkante (`Einstellungen`) zurück nach oben links zum FAB (M3-Verstoß gegen logische Top-Down-Fokusreihenfolge).
     - In `Einstellungen` (`Settings.tsx`) gibt es keinen FAB → es bleibt eine leere `76px`-Lücke in der Rail.
  2. **Blackout-Button (`Scenes.tsx:109-114`, `styles.css:398-404`) verschwindet und überlappt:**
     - Da `.blackout` innerhalb von `Scenes` gerendert wird, **verschwindet der Notfall-Blackout komplett**, sobald der DM kurz in `Bibliothek` oder `Einstellungen` wechselt (widerspricht dem eigenen Kommentar `Scenes.tsx:108`: *„the blackout must stay one click away“*).
     - `position: fixed; bottom: 150px;` kollidiert auf Fenstern `< ~560px` Höhe oder bei 150–200% Textskalierung direkt mit „Bibliothek“ oder „Spieler“.
  3. **Gemischte Semantik & ARIA-Rollen in der Rail (`main.tsx:45-63`):**
     - `Szenen` und `Bibliothek` liegen in `role="tablist"` als `role="tab"`, während `Einstellungen` (wechselt denselben `tab`-State!) außerhalb als `<button aria-current="page">` liegt.
     - `Spieler` öffnet einen Modal-Dialog, sieht aber exakt aus wie eine Navigations-Destination.
     - M3-Navigation-Rails verwenden `<nav>`-Links/Buttons mit `aria-current="page"` für alle Top-Level-Ziele (3–7 Ziele), kein `role="tablist"`.
  4. **Touch-/Klickziel zu schmal & knappes Label:**
     - M3 verlangt volle Rail-Breite (`80dp`) und mindestens `56dp` Höhe pro Item. `.rail-item` setzt `min-height: 0; padding: 0;`, wodurch das Klickziel auf Icon-/Textbreite schrumpft.
     - Das Label `Einstellungen` (13 Zeichen bei `12px`) stößt ohne horizontales Padding nahezu an die Kanten der `80px`-Rail.
  5. **Deaktivierter Menü-Button (`main.tsx:34-43`):**
     - In `Bibliothek` und `Einstellungen` bleibt das Hamburger-Icon dauerhaft sichtbar, ist aber `disabled`. In M3 schaltet der Rail-Menü-Button eine konsistente Navigation-Rail-Erweiterung (Collapsed ↔ Expanded) oder entfällt, wenn es keinen Drawer gibt.

### 4.2 Top App Bar / Scene Toolbar (`SceneEditor.tsx:349-398`, `styles.css:925-938`)

1. **Doppelter „Einpassen“-Button:** `fit_screen` existiert gleichzeitig oben in `.scene-toolbar` (`SceneEditor.tsx:360`) und unten in `.floating-tools` (`SceneEditor.tsx:470`, Tab `Ebenen`).
2. **Gedimmter aktiver „Live“-Button:** Siehe Abschnitt 3.1 (`opacity: 0.38` bei `disabled={isLive}`). Zudem ist im Editor einer nicht-aktiven Szene nicht sofort in der Top Bar ersichtlich, *welche andere Szene* aktuell live ist, wenn die Szenenliste eingeklappt ist.
3. **Framing-Modus ohne `Escape` und ohne Zustandsschutz:** Während `framing === true` ersetzt die Toolbar den View-Toggle durch „Abbrechen“ / „Ausschnitt übernehmen“. Drücken von `Escape` bricht nicht ab; ein Tab-Wechsel im rechten Panel lässt `framing` offen stehen.
4. **Dauerhaftes Filled Text Field in der Top App Bar:** Unüblich für M3 (Top App Bars zeigen typischerweise `Title Large 22px` und öffnen Editiermodus gezielt); bei schmalen Fenstern bewirkt `flex-wrap: wrap` (`styles.css:928`) einen unruhigen zweizeiligen Umbruch der Top Bar.

### 4.3 Floating Toolbars & Stage-Overlays (`SceneEditor.tsx:427-480`, `tools/measure.tsx:93-138`, `styles.css:979-1063,1464-1488`)

1. **Geometrischer Overflow & Clipping im Standardfenster (`1280×800`):**
   - `src/main/index.ts:87` öffnet das DM-Fenster mit `1280×800`. Bei geöffneter Szenenliste (`listOpen = true` als Default, `main.tsx:20`) belegt das feste Chrome `80px` (Rail) + `280px` (Scene List) + `360px` (Panel) + `24px` (Gaps/Paddings) = **`744px`** → für `.stage` bleiben nur ca. **`520–536px`** Breite.
   - Die zentrierte `.floating-tools` benötigt in **`Räume`** ca. **`562–602px`** (`room-chip` + 2 Divider + 3 Buttons + `ModeToggle` „Hinzufügen“/„Entfernen“) und in **`Ebenen` + „Teilen“** ca. **`604px`** (6 Buttons + 2 Divider + „Senkrecht“/„Waagerecht“), in **`Nebel`** ca. **`495px`**.
   - **Folge:** Buttons werden durch `.stage { overflow: hidden }` abgeschnitten und überdecken `.zoom` (`right: 16px; bottom: 16px`) sowie `.side-tools` (`left: 16px`).
   - Zusätzlich misst die vertikale `.side-tools` (`tools/measure.tsx`) mit 8 Buttons + 2 Dividern ca. **`446px` Höhe** und kollidiert bei geringerer Fensterhöhe (z. B. `768px` Laptop) vertikal mit der unteren Toolbar.
2. **Stilmix in der Floating Toolbar:**
   - M3 Floating Toolbars halten Aktionen kompakt (3–6 Icon-Buttons, einheitliche Höhe/Pill-Form). Hier treffen `32px` hohes `<select className="room-chip">` (`8px` Radius), `48px` Icon-Buttons (`16px` Radius) und `40px` breite Text-Segmented-Buttons (`20px` Radius) in einer `28px`-Pill aufeinander.
3. **Inkonsistenter Disabled-State in `Räume`-Toolbar (`tools/rooms.tsx:221-226`):**
   - Im Gegensatz zu `tools/fog.tsx:161-162` wird `<ModeToggle>` im Tab `Räume` **nicht** deaktiviert, wenn kein Raum zum Bemalen aktiv ist (`!painting`), obwohl die drei Form-Buttons links daneben deaktiviert sind.
4. **Mehrdeutige Highlights in der vertikalen Mess-Leiste (`.side-tools`, `tools/measure.tsx:93-138`):**
   - 8 unbeschriftete Icons aus 3 Kategorien (4 exklusive Formen, 2 exklusive Modi „Nur messen“/„Platzieren“, 2 unabhängige Sichtbarkeits-Schalter) verwenden alle identisches `aria-pressed` mit `--primary-container`.
   - Selbst wenn **kein** Messwerkzeug aktiv ist, leuchten bis zu **3 Buttons dauerhaft** in `--primary-container` auf; bei aktivem Werkzeug leuchten **4 Buttons gleichzeitig** identisch.
5. **Permanentes, nicht schließbares `.stage-help`-Overlay (`SceneEditor.tsx:427-429`, `styles.css:1464-1473`):**
   - Der statische Hilfetext (`Rechtsklick: Ping · rechts halten und ziehen: Zeiger (Spieler sehen es erst, wenn die Szene live ist)`) ist im Nicht-Live-Zustand ca. `500px` breit, spannt sich über fast die gesamte obere Kartenbreite und lässt sich nicht ausblenden.
6. **Doppelter CSS-Block:** `.floating-tools` ist in `styles.css:979` und `styles.css:1015` redundant aufgeteilt.

### 4.4 Buttons & Segmented Buttons / Connected Button Groups (`styles.css:56-139,306-330`, `controls.tsx:76-87`)

1. **Padding & Icon-Größen:** M3 Common Buttons nutzen `24dp` horizontales Padding (`16dp` links bei führendem Icon) und `18dp` Icons; Bellavellum nutzt pauschal `16px` Padding und `20px` Icons (außer `.floating-tools .segmented .icon` mit `18px`).
2. **Zu kleine Klickziele in Listen (`styles.css:895-898`):** `.layers li .icon-btn` verkleinert Buttons auf `32×32px` (weit unter M3 `48×48dp`) bei nur `4px` Abstand – besonders riskant beim ungeschützten `delete`-Button neben `arrow_downward`.
3. **Überladung der Klasse `.primary`:**
   - Standard (`styles.css:91`): `--primary` / `--on-primary` (Filled CTA).
   - In `.tool-grid button.primary` (`styles.css:1200`): `--primary-container` / `--on-primary-container` (betrifft „Übernehmen“ in `GridPanel.tsx:77` und aktives „Bereich ziehen“ in `tools/grid.tsx:266`).
   - In `.displays button.primary` (`styles.css:740`): `--secondary-container` / `--on-secondary-container` (Markierung des aktiven Monitors).
   - In `GridPanel.tsx:98` nutzt „Kalibrieren“ im aktiven Toggle-Zustand `.primary` (volles Gold), was visuell wie ein primärer Submit-Button statt eines aktiven Toggle-Buttons wirkt.
4. **Inflation von Filled Tonal Buttons:** Da nackte `<button>`-Elemente standardmäßig Tonal (`--secondary-container`) sind, stapeln sich in Panels viele gleich gewichtete Tonal-Buttons (und auch „Verwerfen“ in `GridPanel.tsx:80` ist Tonal statt Text/Outlined).
5. **Segmented Buttons (`styles.css:306-330`):**
   - Im aktuellen **M3 Expressive** wurden klassische Segmented Buttons zugunsten von **Connected Button Groups** abgekündigt; selbst nach klassischer M3-Spec fehlen Hover-State-Layer (s. 3.2) und Checkmark-Indikator bei rein textlichen Segmenten.
   - `margin-left: -1px` steht nur auf `:last-child` (`styles.css:324`) – bei 3+ Segmenten entstehen doppelte `2px`-Trennlinien.
   - Die rein symbolische Segmented Group in `SceneEditor.tsx:374-392` (`panorama` / `crop`) ist ohne Labels schwer zu deuten, zumal `crop` unten erneut für Ebenenzuschnitt verwendet wird.

### 4.5 Tabs (`styles.css:282-304,540-559,1250-1257`, `Library.tsx`, `AssetPicker.tsx`, `SceneEditor.tsx`)

1. **Vermischung von Primary & Secondary Tab-Specs:** Alle Tabs verwenden einen vollbreiten, eckigen `3px`-Indikator (`inset 0 -3px 0 var(--primary)`). M3 definiert Primary Tabs mit **labelbreitem** `3dp`-Indikator und gerundeten oberen Ecken (`3px 3px 0 0`), Secondary Tabs mit vollbreitem `2dp`-Indikator.
2. **Fehlender Bottom-Divider in `AssetPicker` (`AssetPicker.tsx:28-34`):** Im Gegensatz zu `.toolbar` und `.panel-tabs` fehlt unter dem `tablist` im `AssetPicker` die M3-Trennlinie (`1px solid var(--outline-variant)`).
3. **Inline-Zähler statt M3-Badge (`Library.tsx:120`):** `{LABELS[k]} · {count}` verlängert die Tab-Labels; in M3 werden Zähler als **Badge** am Icon platziert.
4. **Fehlendes WAI-ARIA-Tab-Pattern:** Alle 4 `role="tablist"`-Instanzen (`main.tsx:45`, `Library.tsx:116`, `AssetPicker.tsx:28`, `SceneEditor.tsx:491`) implementieren weder Pfeiltasten-Navigation (`ArrowLeft`/`Right` bzw. `ArrowUp`/`Down`) noch Roving `tabIndex` noch zugehörige `role="tabpanel"` / `aria-controls`. Außerdem haben zwei verschiedene Tablists fast identische Namen (`"Bereich"` vs. `"Bereiche"`).

### 4.6 Text Fields, NumberField, Selects & Color Inputs (`styles.css:158-200,1205-1215,1308-1326`, `controls.tsx`)

1. **Drei inkonsistente Eingabestile:**
   - `.text-field` (`56px`, M3 Filled Text Field) nur für Szenenname & Gemini-API-Key.
   - Nackte `<input>`/`<select>` in `.prop` (`~33px` hoch, linksseitiges `12px`-Label, Fokus über äußere `outline` statt `2px` Bottom-Indicator).
   - Ungelabelte Inline-Inputs `.room-name` (`RoomPanel.tsx:49`) und `.area-name` (`SceneEditor.tsx:543`) mitten in Listen.
2. **Kein echtes Floating Label & fehlendes Passwort-Toggle:**
   - `.text-field` hält das Label auch bei leerem Feld permanent oben (`12px`), statt es aus der Feldmitte (`16px`) beim Fokussieren/Ausfüllen hochgleiten zu lassen.
   - In `Settings.tsx:53` (`type="password"`) fehlt ein Trailing-Icon-Button (`visibility`/`visibility_off`) zum Prüfen des eingefügten API-Keys sowie eine M3-Error-State-Darstellung.
3. **Kritischer Eingabebug in `NumberField` (`controls.tsx:50-66`):**
   - `onChange` verwirft `e.target.value === ''` und Werte `< min`. Dadurch lässt sich ein Feld wie „Feldgröße“ (`min={5}`, `GridPanel.tsx:58`) weder mit Backspace leeren noch durch Eintippen von `10` (erster Tastendruck `1 < 5` wird abgelehnt!) direkt überschreiben. Auch das Tippen von `-` bei `Versatz X/Y` scheitert, da `Number('-')` `NaN` ist.
4. **Bug beim erneuten Auswählen einer Effekt-Datei (`SceneEditor.tsx:570-586`):**
   - Sobald einer Fläche eine Datei zugeordnet ist, bleibt `select.value === 'asset'`. Wählt der DM erneut den Eintrag `{a.asset}`, feuert `onChange` nicht – um eine andere Datei zu wählen, muss erst „Kein Effekt“ und dann erneut „Datei …“ gewählt werden.
5. **Native `<select>` & `<input type="color">`:**
   - Entsprechen nicht M3 Exposed Dropdown Menus (kein M3-Menu-Container, keine M3-Elevation/Shape, inkonsistente Options-Hintergründe) bzw. M3-Farbswatches.
6. **Enge Spalten im `.prop`-Grid (`styles.css:1310`):**
   - `grid-template-columns: 88px minmax(0, 1fr) 48px` lässt bei >125% Textskalierung (M3 fordert Unterstützung bis 200%) Labels (`Mischmodus`, `Bezeichnung`) und `<output>`-Werte (`10,5 F.`, `-180°`) abschneiden oder umbrechen.

### 4.7 Switches & Sliders (`styles.css:202-280`, `controls.tsx:23-40`)

#### Switches
- **Positiv:** Track (`52×32px`), Border (`2px`), Handle-Größen (`16px → 24px`) und Farben entsprechen sehr genau den M3-Specs.
- **Abweichungen:**
  - Kein `40dp` State-Layer-Kreis um den Handle bei Hover/Focus/Pressed.
  - Kein Handle-Wachstum auf `28dp` im `:active`-Zustand.
  - Wenn ein Switch deaktiviert ist (`FogPanel.tsx:32`), wird nur der Toggle auf `0.38` gedimmt; der zugehörige Label-Text „Fog aktiv“ bleibt bei `100%` Opacity. Zudem fehlt `cursor: pointer` auf `.check`.

#### Sliders
- **Positiv:** Aktuelle M3-Slider-Geometrie (`16px` Track, `4px` vertikaler Handle, aktive/inaktive Track-Farben).
- **Befunde:**
  1. **Visueller Gap-Bug in `LayerProps` (`styles.css:278` vs. `:1290`):** Der transparente M3-Abstand links/rechts vom Handle wird per `box-shadow: 0 0 0 4px var(--surface-low)` (`#1f1b13`) simuliert. Alle 7 Slider in `LayerProps.tsx` liegen aber in `.props` auf `--surface-container` (`#231f17`) → sichtbarer dunkler Rechteck-Kasten um jeden Slider-Handle.
  2. **Fehlender Centered Slider für `Drehung` (`LayerProps.tsx:48`):** Für symmetrische Bereiche (`-180°` bis `+180°`) sieht M3 einen zentrierten Slider vor, dessen Füllung von `0°` nach links/rechts wächst; aktuell wirkt `0°` wie „50 % gefüllt“.
  3. **Fehlende M3-Slider-Elemente:** Kein Stop-Indicator-Punkt am Track-Ende, keine schwebende Value-Indicator-Bubble beim Ziehen, kein Handle-Verschmalern (`4px → 2px`) beim Ziehen.
  4. **`NaN%`-Edge-Case (`controls.tsx:34`):** Wenn bei den Zuschneiden-Slidern (`LayerProps.tsx:35`) der gegenüberliegende Wert `95 %` beträgt, ist `min === max === 0` → `(value - min) / (max - min)` ergibt `NaN%` im CSS-Gradienten.
  5. **Klickzielhöhe:** Der Track ist nur `16px` hoch (Thumb `32px` statt M3 `44dp` bei `48dp` Touch-Target).

### 4.8 Cards / Bibliothek & AssetPicker (`Library.tsx`, `AssetPicker.tsx`, `styles.css:561-636`)

1. **Hover-only Delete-Button (`styles.css:596-607`):** `.tile .remove` ist bei `opacity: 0` ohne Touch-Fallback – auf Tablets/Touch-Laptops ist Löschen in der Bibliothek unsichtbar und unentdeckbar.
2. **Fehlende Such-, Sortier-, Umbenenn- und Vorschaufunktionen:** Im Projektordner `data/assets/maps/` liegen reale Dateien mit 32-stelligen Hash-Namen (z. B. `015ec69ac3f00f436148ff48feefbac1.jpg`). Weder `Library` noch `AssetPicker` bieten eine M3 Search Bar, Sortierung, Umbenennung oder Detailvorschau.
3. **Löschen ohne Referenzprüfung:** Beim Verschieben eines Assets in den Papierkorb (`Library.tsx:169`) erfolgt keine Warnung, falls Szenen dieses Asset noch nutzen.
4. **Drag-and-Drop-Outline kann hängen bleiben (`Library.tsx:102-104`):** `if (e.currentTarget === e.target) setDragging(false)` setzt `dragging` nicht zurück, wenn der Cursor die Dropzone direkt über eine Kind-Kachel verlässt.
5. **`.drop-card` Kontrast & Platzierung (`Library.tsx:176-180`, `styles.css:609-636`):** Nutzt `2px` `--outline-variant` (`1.84:1`, unter WCAG 3:1) statt `--outline` und wandert bei vielen Assets ans Ende der Scroll-Liste.

### 4.9 Dialoge & Modals (`DisplayPicker.tsx`, `AssetPicker.tsx`, `PdfImport.tsx`, `styles.css:638-750`)

1. **Schwere Barrierefreiheitslücken:**
   - Keine **Focus Trap**, kein Initial-Focus im Dialog und keine Fokus-Rückgabe beim Schließen. (Ein natives `<dialog>` mit `showModal()` würde Focus-Trap, Top-Layer, `::backdrop` und `Escape` in Chromium/Electron nativ liefern.)
   - Kein Klick auf den Scrim zum Schließen.
   - **`PdfImport.tsx` hat keinen `Escape`-Handler** (im Gegensatz zu `DisplayPicker.tsx:11` und `AssetPicker.tsx:18`).
2. **Falsche Dialog-Dimensionierung (`styles.css:652`):**
   - Alle Modals teilen sich `width: min(900px, 90vw)`. Für den kurzen `DisplayPicker` widerspricht das der M3 Basic-Dialog-Spec (`min 280dp`, **`max 560dp`**) – Monitorname und Auflösung reißen extrem weit auseinander.
3. **Fehlende M3-Scroll-Divider:** Bei scrollbaren Dialoginhalten (`.modal .grid`, `.pdf-pages`) fordert M3 `1dp`-Trennlinien oben und unten zwischen Scrollbereich, Titel und Aktionsleiste.
4. **Native `window.confirm()` & `window.alert()`:**
   - Genutzt in `Scenes.tsx:99`, `Library.tsx:169`, `RoomPanel.tsx:68` und `DisplayPicker.tsx:21`. Sie rendern im OS-Standardstil (oft hell), blockieren den Main-Thread und brechen den M3-Look komplett. Da Szenen und Assets ohnehin in `data/trash/` landen, wäre ein M3-**Snackbar mit „Rückgängig“** (oder M3 Confirmation Dialog) deutlich stimmiger.
5. **`PdfImport`-UX (`PdfImport.tsx:66-97`):**
   - Kein „Alle auswählen / Auswahl aufheben“ für große PDFs.
   - Kein visuelles Checkmark-Badge auf ausgewählten Seiten (verlässt sich nur auf Farbwechsel/Rahmen).
   - Fortschrittstext (`{progress}`) klebt ohne `margin-right: auto` und ohne M3 Linear Progress Indicator direkt links neben den Buttons in `.modal-actions`.

### 4.10 Feedback, Fehlermeldungen & Ladezustände

1. **Fehlerbanner widerspricht M3 (`styles.css:419-427`, `Scenes.tsx:117-128`, `Library.tsx:145-156`):**
   - Neutraler Hintergrund (`--surface-highest`), normale Textfarbe (`--on-surface`), kein Fehler-Icon → optisch nicht als Fehler erkennbar.
   - Duplikat-Hinweise (`Library.tsx:56-59`) landen als harmlose Infos im selben `role="alert"`-Fehlerblock wie echte Kopierfehler; Fehler akkumulieren unbegrenzt ohne Deduplizierung.
   - In `Settings.tsx:19,64` sehen Erfolg („Key gespeichert.“) und Fehler („Speichern fehlgeschlagen: …“) identisch aus (`12px` `.supporting`).
2. **Komplettes Fehlen von M3 Progress Indicators:**
   - **Gemini-Raumvorschlag (`tools/rooms.tsx:41-65`):** Mehrminütige Netzwerkanfrage zeigt nur statischen `12px`-Text ohne Spinner/Linear Progress und ohne Abbrechen-Button.
   - **PDF-Import (`PdfImport.tsx:71,83`), Raster-Erkennung (`tools/grid.tsx:99`), Thumbnail-Erzeugung (`Library.tsx:28-46`, schwarze `.no-thumb`-Flächen) und Zuschnitt-Export (`tools/layerEdit.tsx:112`):** Nirgends gibt es einen Circular/Linear Progress Indicator oder Skeleton-State.
3. **Unvollständige Live-Regions:** `RoomPanel.tsx:92` (`wandInfo`) und `RoomPanel.tsx:105` (`suggestInfo`) fehlt `role="status"` (vorhanden in `GridPanel`, `LayerProps`, `SceneEditor`, `Settings`).
4. **Kein Autosave-Indikator:** `SceneEditor.tsx` speichert mit 300ms Debounce still im Hintergrund; ein dezenter Speicherstatus fehlt (wichtig beim USB-Stick-Betrieb vor dem Abziehen).

### 4.11 Side Panels: Szenenliste & Inspector-Panel (`Scenes.tsx`, `SceneEditor.tsx:483-650`, `styles.css:818-915,1226-1327`)

1. **Schwache Empty States:**
   - Bei 0 Szenen ist `.scene-list` unter `<h2>Szenen</h2>` leer; in `.scene-main` klebt `<p className="empty">` ohne Container, ohne Icon und ohne CTA-Button links oben auf dem rohen `--surface`-Hintergrund (`Scenes.tsx:139`).
   - Wenn keine Szene live ist, zeigt `<details className="preview">` (`SceneEditor.tsx:484-489`) ein **tiefschwarzes, unkommentiertes Rechteck** (`PlayerView`), das wie ein Ladefehler wirkt.
2. **Natives `<details>`/`<summary>` (`SceneEditor.tsx:484-489`):** Verwendet Browser-Standard-Dreieck statt eines M3-List-Header-Elements mit `expand_more`-Icon, State Layer und `48px` Mindesthöhe.
3. **Rechtes Panel nicht einklappbar:** Anders als die linke Szenenliste lässt sich das `360px` breite `.panel` nicht ausblenden, um auf kleineren Bildschirmen maximale Kartenfläche zu gewinnen.
4. **Überladene Ebenen-Zeilen (`SceneEditor.tsx:504-592`):**
   - 5 nebeneinanderliegende `32×32px`-Icons pro Ebene lassen nur ~`140px` für den Ebenennamen.
   - `arrow_upward` (oberste Ebene) und `arrow_downward` (unterste Ebene) sind nie `disabled`, sondern laufen still ins Leere (`SceneEditor.tsx:126`).
   - Untergeordnete Flächen (`.area-row`) stapeln Inline-Textfeld, Farbwähler, Select und 2 Buttons dauerhaft offen in die Ebenenliste, statt einklappbar oder über Selektion im unteren Eigenschaftenbereich bearbeitet zu werden.
5. **Szenenliste aktualisiert Sortierung nach Umbenennung nicht sofort:** `listScenes` sortiert alphabetisch (`src/main/scenes.ts:163`), `Scenes.tsx:76` aktualisiert den Namen jedoch an alter Position bis zum nächsten Reload. Zudem fehlen Szenen-Duplizieren und Suche.

### 4.12 Tooltips, Electron-Fenster & Player-Fenster

1. **Natives `title`-Attribut statt M3 Tooltips:** Alle Icon-Buttons und lange Werkzeugbeschreibungen (bis zu 115 Zeichen in `tools/measure.tsx:101`) nutzen HTML `title`. Nachteile: ~1s Verzögerung, OS-Styling bricht Dark-M3-Theme, **per Tastaturfokus komplett unerreichbar** (WCAG 1.4.13 / M3 Accessibility). M3 sieht Plain Tooltips (`--inverse-surface`, `4dp` Radius) und Rich Tooltips (`--surface-container`, `12dp` Radius) vor.
2. **Electron-DM-Fenster (`src/main/index.ts:86-95`):**
   - Im Gegensatz zum Player-Fenster (`win.setMenu(null)`, `L75`) behält das DM-Fenster die **englische Standard-Chromium-Menüleiste** (`File`, `Edit`, `View`, `Window`, `Help`) im OS-Look über der deutschen Material-3-App.
   - Es sind weder `minWidth` noch `minHeight` gesetzt; unter `744px` Breite kollabiert die Stage auf `0px`.
3. **Player-Fenster (`Player.tsx`, `styles.css:754-760`):**
   - Vollbild auf Zweitmonitor mit `cursor: none` ist für die Tischprojektion ideal. Im Fenstermodus auf dem Primärbildschirm (`960×540`, `main/index.ts:69`) blendet `cursor: none` allerdings den Mauszeiger aus, sobald der DM das Fenster überfährt.

---

## 5. UX, Workflows, Barrierefreiheit & Sprachkonsistenz

### 5.1 Kritische Workflow- & Sicherheitslücken
1. **Zustandsverlust beim Hauptbereich-Wechsel (`main.tsx:65`):**
   - Bedingtes Rendern (`tab === 'scenes' ? <Scenes /> : ...`) zerstört `Scenes`, `SceneEditor` und `Library` bei jedem Wechsel. Ein kurzes Importieren eines Tokens in der Bibliothek oder Eintragen des Gemini-Keys in den Einstellungen schließt die geöffnete Szene, setzt Kamera/Panel-Tab/Auswahl zurück, setzt die Bibliotheks-Kategorie auf „Karten“ zurück und **bricht eine laufende Gemini-Raumerkennung spurlos ab**.
2. **Kein Undo / Redo (`Ctrl+Z` / `Ctrl+Y`) bei hohem Fehlbedienungsrisiko:**
   - Ein Fehlklick auf **„Alles aufdecken“** (`FogPanel.tsx:53`) enttarnt ohne Rückfrage sofort die gesamte Dungeon-Karte auf dem Live-Spielerbildschirm – irreversibel.
   - Ein Fehlklick auf Löschen bei einer **Ebene** (`SceneEditor.tsx:534`) vernichtet sofort alle kalibrierten lokalen Raster und platzierten Zauberflächen dieser Ebene ohne Rückfrage und ohne Undo.
3. **Tastatur- & Trackpad-Ergonomie:**
   - In der gesamten App gibt es nur **2 `keydown`-Listener** (`Escape` in `AssetPicker` und `DisplayPicker`).
   - Es fehlen: `Escape` zum Beenden aktiver Werkzeuge/Framing/`PdfImport`, `Space + Ziehen` zum Pannen bei aktivem Werkzeug (derzeit geht nur die mittlere Maustaste – auf Laptop-Trackpads faktisch unbenutzbar!), `+`/`-`/`0` sowie klickbare Zoom-Buttons (`.zoom` ist `pointer-events: none`), und eine Trackpad-Alternative zum Rechtsklick-Ping/Laserpointer.
4. **Fehlende adaptive Layouts (M3 Window Size Classes):**
   - Das Drei-Spalten-Layout (`80 + 280 + Stage + 360`) passt sich nicht an mittlere Fensterbreiten (M3 Medium `600–839dp` / Expanded `840–1199dp`) an, z. B. durch automatisches Einklappen der Szenenliste oder Modal-Drawer.

### 5.2 Text-, Begriffs- & Informationsarchitektur-Inkonsistenzen
1. **Falscher Bedienhinweis („Schere-Werkzeug“):** `LayerProps.tsx:78` verweist unter **„Zuschneiden“** auf das „Schere-Werkzeug“. Das Scheren-Icon (`content_cut`) gehört jedoch zum **Teilen**-Werkzeug (`tools/layerEdit.tsx:91`), während Zuschneiden das `crop`-Icon (`L76`) nutzt.
2. **Uneinheitliche Terminologie (Deutsch / Englisch gemischt):**
   - `Nebel` (`SceneEditor.tsx:23`) vs. `Fog` (`FogPanel.tsx:35,55`, `tools/fog.tsx:48,149`) vs. `Fog of War` (`RoomPanel.tsx:109`).
   - `Karte` (`Library.tsx:7`, `FogPanel.tsx:37`, `GridPanel.tsx:74`) vs. `Map` (`Settings.tsx:30`, `RoomPanel.tsx:99`, `tools/rooms.tsx:43`).
   - `Bildschirm` / `Spielerbildschirm` (`main.tsx:56`, `DisplayPicker.tsx:28`) vs. `Display` / `Displays` (`Library.tsx:111`).
3. **Verweise auf nicht sichtbare Button-Beschriftungen:**
   - `SceneEditor.tsx:426`: *„Ebene hinzufügen…“ wählt eine Karte* — der Button ist ein unbeschriftetes Icon (`add_photo_alternate`) und sein `title` hat keine Auslassungspunkte.
   - `Scenes.tsx:139`: *Szene links auswählen oder „Neue Szene“ anlegen* — der FAB zeigt nur ein `+`-Icon ohne Text, und bei eingeklappter Szenenliste gibt es „links“ keine Liste.
4. **Fehlplatzierte App-Metadaten (`Library.tsx:109-113`):**
   - Datenordner-Pfad (`info.dataDir`) und Monitoranzahl (`info.displayCount`) stehen im Kopf der **Bibliothek** statt in den **Einstellungen** (und die Monitoranzahl gehört zum Spielerbildschirm-Bereich).
5. **Unverlinkte URL in Settings (`Settings.tsx:56`):** `aistudio.google.com` ist reiner Text ohne kopier-/öffenbaren Link-Hinweis.

---

## 6. Ergebnisse der Live-UI/UX-Prüfung (Laufzeit-Verifikation in Electron)

Die gebaute Electron-App (`out/main/index.js`) wurde live mit realen Projektdaten (Szene mit Schiffskarte, Raster und 8 Räumen, 7 Bibliothekskarten, angeschlossenem Hochformat-Zweitmonitor `1080×1920`) gestartet, per Chrome DevTools Protocol (CDP) bedient, geometrisch vermessen und anhand von **18 Screenshots** visuell geprüft. Alle Datenänderungen wurden danach über ein Backup byte-identisch zurückgesetzt.

### 6.1 Laufzeit-Umgebung & Grundmetriken
- **Fenster-Overhead:** `outerWidth: 1280 × outerHeight: 800` → nutzbarer Viewport `innerWidth: 1264 × innerHeight: 735` (**`65px` Höhenverlust** durch Windows-Titelleiste und die englische Electron-Standardmenüleiste).
- **Geladene Fonts (`document.fonts`):** `Roboto:400`, `Roboto:500`, `Material Symbols Rounded:100 700` → bestätigt, dass **`Roboto:600` nicht geladen** ist.
- **Konsole / Exceptions:** `0` JavaScript-Fehler oder Warnungen während der gesamten Testsession.

### 6.2 Gemessene Layout- & Überlauf-Werte (Stage & Floating Toolbars)

| Zustand / Viewport | Stage (`B × H`) | Untere Toolbar (`B`) | Clipping links / rechts | Überlappt `.zoom`? | Überlappt `.side-tools`? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `1280×800` – `Ebenen` (Liste offen) | `520 × 647 px` | `337 px` | `0 / 0 px` | Nein | Nein |
| `1280×800` – `Ebenen` + **Teilen** | `520 × 647 px` | **`601 px`** | **`40 px / 40 px`** | **Ja** (`65 %` auf „Waagere…“) | Nein |
| `1280×800` – `Raster` | `520 × 647 px` | `168 px` | `0 / 0 px` | Nein | Nein |
| `1280×800` – `Nebel` | `520 × 647 px` | `479 px` | `0 / 0 px` | **Ja** (`65 %` auf „Verdecken“) | – |
| `1280×800` – **`Räume`** | `520 × 647 px` | **`593 px`** | **`36 px / 36 px`** („um wählen…“ / „- Entfern“) | **Ja** | – |
| `1280×800` – `Ebenen` (Liste zu) | `808 × 647 px` | `337 px` | `0 / 0 px` | Nein | Nein |
| **`1024×600`** – `Ebenen` (Liste offen) | `280 × 512 px` | `337 px` | **`28 px / 29 px`** | **Ja** | **Ja** (verdeckt untersten Button + `.stage-help`) |
| **`960×500`** – `Ebenen` (Liste offen) | **`216 × 412 px`** | `337 px` | **`60+ px`** | **Ja** | **Ja** (`.side-tools` ragt oben & unten aus der Stage) |

### 6.3 Live reproduzierte Interaktions-, Fokus- & UX-Tests

| Testfall | Live-Beobachtung | Ergebnis |
| :--- | :--- | :---: |
| **Tab-Reihenfolge (Startansicht)** | `Szenenliste (y:16)` → `Szenen (156)` → `Bibliothek (218)` → `Spieler (607)` → `Einstellungen (669)` → **Rücksprung auf FAB `Neue Szene` (`y:72`)** | **Fail** |
| **`NumberField` (`Feldgröße`, `min=5`)** | Wert `29.29` selektiert → `Backspace` → Wert bleibt `29.29` → Tippen von `1` → Wert bleibt `29.29` | **Fail** |
| **Live-Button im Aktivzustand** | `disabled: true`, `opacity: 0.38`, `background: rgb(147, 0, 10)` → visuell kaum lesbarer dunkler Schatten | **Fail** |
| **`LayerProps` gesperrtes `fieldset`** | `fieldset` `opacity: 0.5` × Button `opacity: 0.38` → „90° drehen“ visuell fast unsichtbar | **Fail** |
| **Slider-Gap in `.props`** | `.props` `rgb(35,31,23)` vs. `.panel` `rgb(31,27,19)` → sichtbarer dunkler Schattenrahmen um jeden Slider-Handle | **Fail** |
| **Framing-Modus + `Escape`** | `framingCancelledByEscape: false` | **Fail** |
| **Aktives Mess-Tool + `Escape`** | `toolCancelledByEscape: false` (4 Buttons gleichzeitig in `.side-tools` hervorgehoben) | **Fail** |
| **`AssetPicker` Modal** | `modalInitialFocus: "icon-btn"` (Fokus bleibt im Hintergrund!), `closedByScrim: false`, `escapedModal: true`; Fokusring auf erster Kachel visuell komplett abgeschnitten | **Fail** |
| **`DisplayPicker` Breite** | Gemessene Modalbreite: **`900 px`** für 2 Monitorzeilen (M3 Basic Dialog max. `560 dp`) | **Fail** |
| **Blackout in `Bibliothek`/`Einstellungen`** | `blackoutVisibleInLibrary: false`, `blackoutVisibleInSettings: false` trotz laufender Live-Szene | **Fail** |
| **Tab-Wechsel-State-Erhalt** | Wechsel `Szenen` → `Bibliothek` → `Einstellungen` → `Szenen`: `statePreservedAfterTabSwitch: false` (Szene geschlossen!) | **Fail** |
| **Pfeiltasten in `tablist` (`Bibliothek`)** | Fokus auf „Karten · 7“ + `ArrowRight` → aktiver Tab bleibt „Karten · 7“ | **Fail** |
| **`Räume` ModeToggle bei `!painting`** | „Hinzufügen“ & „Entfernen“ bleiben `disabled: false` trotz deaktivierter Form-Icons | **Fail** |

### 6.4 Zusätzliche neue Befunde (erst durch die Live-Ansicht entdeckt)

1. **Framing-Hinweis oben abgeschnitten & kollidiert mit `.stage-help` + aktive Toolbar (`SceneEditor.tsx:430-437`, `styles.css:785-805`):**
   - Weil `frame` 90 % der Stage-Höhe einnimmt, bleiben oben nur ~`32 px` Rand; das darüber platzierte zweizeilige gelbe `.frame-mask span`-Banner (~`48 px`) wird am oberen Stage-Rand halb abgeschnitten und überdeckt gleichzeitig `.stage-help` („…ziehen: Zeiger“ ragt rechts heraus).
   - Zudem bleiben `.floating-tools` (und `.side-tools`) während des Framing-Modus sichtbar und bedienbar über der Maske liegen.
2. **`.layer-name` schneidet Dateinamen ohne Ellipsis (`…`) ab (`SceneEditor.tsx:507`, `styles.css:67,870-883`):**
   - `button` hat `display: inline-flex`. Auf Flex-Containern greift `text-overflow: ellipsis` für direkten Textknoten-Inhalt nicht (anders als bei `.scene-name > span`). Namen wie `9abf04ab2890ef1d…` werden hart bei `9abf04ab2890ef1c` ohne `…` abgeschnitten.
3. **Unleserliche, kollidierende Raum-Labels & dauerhafte Raum-Overlays (`SceneView.tsx:347-352`, `tools/rooms.tsx:27`):**
   - Bei realen Schiffsräumen nebeneinander verschmelzen die weißen `.room-label`-Texte zu unlesbarem Textbrei (`"KojVorratskaArrestzelle"`), während `"Kapitänskajüte"` unten hinter der Floating Toolbar verschwindet.
   - Weil `showRooms` standardmäßig `true` ist, liegen alle farbigen Raum-Overlays auch in den Tabs `Ebenen`, `Raster` und `Nebel` dauerhaft über der Karte.
4. **Textskalierung (`24px` Root) bricht `.panel-tabs` & skaliert fixe `px` nicht mit (`styles.css`):**
   - Bei erhöhter Basis-Schriftgröße (WCAG 1.4.4 / M3 200 %-Skalierung) wächst nur vererbter Text (Buttons/Tabs), wodurch der Tab **`Räume` im `360px`-Panel abgeschnitten (`"Rä"`)** wird und einen horizontalen Scrollbar erzeugt, während alle hartkodierten `px`-Labels (`Szenenname`, `Ebenen`, `.rail-item`, `.live-badge`) komplett starr bleiben.
5. **`.area-row` ohne Form-Indikator & knappes Spacing (`SceneEditor.tsx:542-588`, `styles.css:1437-1462`):**
   - Platzierte Flächen zeigen in der Ebenenliste nur Textfeld + Farbfeld + Effekt-Dropdown, ohne visuelles Icon für die Flächenform (Explosion/Kegel/Linie/Lineal) und ohne vertikalen Abstand zwischen Namensfeld und Farbleiste.
6. **Hochformat-Spielerbildschirm in der Vorschau (`SceneEditor.tsx:484-489`):**
   - Bei einem vertikalen Zweitmonitor (`1080×1920`) erzeugt `<PlayerView>` einen `200px` hohen schmalen schwarzen Block mit breitem Leerraum links und rechts; ohne aktive Live-Szene wirkt er wie ein kaputtes schwarzes Kästchen.
7. **Spielerfenster-Titel wird von `index.html` überschrieben (`src/main/index.ts:66`, `src/renderer/index.html:6`):**
   - `new BrowserWindow({ title: 'Bellavellum – Spieler' })` wird beim Laden von `index.html` durch `<title>Bellavellum</title>` überschrieben. In Windows Taskleiste und Alt+Tab heißen beide Fenster identisch „Bellavellum“.
8. **Kollaps auf kleinen/niedrigen Fenstern (`1024×600` & `960×500`):**
   - `.side-tools` (`454px` hoch) kollidiert gleichzeitig mit `.stage-help` oben und `.floating-tools` unten; bei `960×500` ragt das unterste Icon von `.side-tools` sichtbar unter der unteren Floating Toolbar hervor, während das oberste Icon abgeschnitten wird.

---

## 7. Vollständiger Umsetzungsplan

Der detaillierte, nach Arbeitspaketen strukturierte Umsetzungsplan (inkl. betroffener Dateien, technischer Spezifikation, Akzeptanzkriterien, Teststrategie und offenen Produktentscheidungen) befindet sich in [UI_UX_IMPLEMENTATION_PLAN.md](file:///d:/Dev/Bellavellum/UI_UX_IMPLEMENTATION_PLAN.md).
