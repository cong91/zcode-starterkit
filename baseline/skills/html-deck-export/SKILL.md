---
name: html-deck-export
description: Use when building HTML-based slide decks that need to ship as PDF or editable PPTX. MUST load BEFORE writing the first line of HTML if PPTX (with editable text) is a delivery target — choosing the wrong architecture costs 2-3 hours of rework. Covers multi-file vs single-file deck architecture, browser presentation, PDF export, and the 4 hard constraints for editable PPTX.
---

# HTML Deck Export

> Adapted from `huashu-design`. The hardest checkpoint isn't "single-file or multi-file" — it's **"what's the final delivery format?"** Get this wrong and you're rewriting 17 pages of HTML.

## The Critical Decision (Before First Line of HTML)

```
Q: What's the final delivery format?
├── Browser fullscreen presentation only / local HTML  → maximum visual freedom
├── PDF (print / share / archive)                      → maximum visual freedom, any architecture exports
└── Editable PPTX (teammates will edit text)           → 🛑 MUST follow 4 hard constraints from the first line
```

**Why "editable PPTX" forces decisions early**: PPTX with editable text requires `html2pptx`-style element-by-element DOM translation. That tool needs a structurally constrained HTML (see "4 Hard Constraints" below). Writing visually-rich HTML and converting after is a 2-3 hour rewrite. **From-scratch with constraints adds ~5 minutes per slide.**

### Real-Cost Comparison

| Path                                  | Approach                                               | Result                                                                       | Cost                                                              |
| ------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ❌ **Free-form HTML, fix PPTX later** | Single-file deck-stage + lots of SVG / span / gradient | To get editable PPTX: hand-write hundreds of pptxgenjs lines OR rewrite HTML | **2-3 hour rework + ongoing maintenance debt** (HTML edit ≠ PPTX) |
| ✅ **Path-A constraints from line 1** | Per-page HTML + 4 constraints + 720×405pt              | One command exports 100% editable PPTX, also presents in browser             | **+5 min per slide thinking "how do I wrap text in `<p>`?"**      |

## Opening Questionnaire (paste-ready)

> Before I touch HTML, confirm delivery:
>
> - **Browser presentation / PDF** → I can use animations, web components, complex SVG, CSS gradients
> - **Editable PPTX** (someone will edit text in PowerPoint) → I must follow 4 hard HTML constraints from the start. Visual capabilities reduce (no gradients, no web components, no complex SVG), but export becomes a single command
>
> Which?

**Mixed delivery clarifications:**

- "I want HTML presentation **and** editable PPTX" → not actually mixed. Path-A HTML _is_ presentable HTML; just add a deck index. Zero extra cost.
- "I want PPTX **and** animation/web component" → real conflict. Make the user choose. Don't silently hand-write pptxgenjs (becomes permanent maintenance debt).

## Architecture: Single-File vs Multi-File

After delivery format is locked, pick architecture:

| Architecture             | When                                                 | Pattern                                                                  |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| **Multi-file** (default) | ≥10 pages, academic/courseware, multi-agent parallel | Each page is its own HTML; an `index.html`/iframe stitcher combines them |
| **Single-file**          | ≤10 pages, pitch decks, cross-page state needed      | One HTML with a slide container component (web component or React)       |

**Multi-file advantages**: independent CSS scopes (no specificity wars), trivial parallel work, individual page reload during dev.
**Single-file advantages**: one file to share, easy state sharing across slides.

### Multi-File Stitcher (skeleton)

```html
<!-- index.html -->
<!doctype html>
<style>
  body {
    margin: 0;
    background: #000;
  }
  iframe {
    display: block;
    width: 100vw;
    height: 100vh;
    border: 0;
  }
</style>
<iframe id="stage" src="01.html"></iframe>
<script>
  const slides = ["01.html", "02.html", "03.html", "04.html"];
  let i = 0;
  const stage = document.getElementById("stage");
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && i < slides.length - 1) i++;
    if (e.key === "ArrowLeft" && i > 0) i--;
    stage.src = slides[i];
  });
</script>
```

Each `NN.html` is a fully standalone, double-clickable slide.

### Single-File Pattern (web component or React)

```html
<deck-stage>
  <section class="active">Slide 1</section>
  <section>Slide 2</section>
</deck-stage>
<script src="deck_stage.js"></script>
```

Two **hard constraints** for the web-component pattern:

- The `<script>` tag for the component **must come after** the `</deck-stage>` close tag (else slot rendering breaks)
- Section's `display: flex` must be on the `.active` class (not the section itself, else inactive slides fight for space)

## The 4 Hard Constraints for Editable PPTX

If you need editable PPTX export (via `html2pptx`-style tooling):

1. **Body fixed at 720pt × 405pt** — _not_ 1920×1080px. Use `pt` units for the deck container (PowerPoint's native unit).
2. **All text wrapped in `<p>` or `<h1>`–`<h6>`** — never plain `<div>` with text. Never `<span>` as the primary text carrier.
3. **`<p>` and `<h*>` themselves cannot have background / border / shadow** — put those on an outer `<div>`.
4. **No `background-image` on `<div>`** — use real `<img>` tags. No CSS gradients. No web components. No complex decorative SVG.

**If your HTML violates any of these**, the editable export will produce broken slides or fail outright. The _image-mode_ PPTX export (slide rendered as an image, embedded in PowerPoint) doesn't have these constraints — but the result is **not editable**.

## Two PPTX Export Modes

| Mode              | Visual fidelity       | Editability                        | When                                                                  |
| ----------------- | --------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| **Image mode**    | 100% — pixel-perfect  | None — text is image               | Visual-rich slides, no edits expected, PDF-equivalent in PPTX wrapper |
| **Editable mode** | Reduced — constraints | Full — text editable in PowerPoint | Teammates will edit text, brand-spec font fallbacks expected          |

Tools (per huashu-design pattern):

- `playwright` for browser rendering (already in this kit)
- `pptxgenjs` for PPTX object construction
- `pdf-lib` for multi-page PDF merge
- `sharp` (only for editable mode image fallbacks)

## PDF Export (Easy Path)

PDF tolerates any HTML architecture. Per-page browser screenshot → merge.

```js
// scripts/export-deck-pdf.mjs (skeleton)
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import fs from "fs";

const slides = fs.readdirSync("slides").filter((f) => f.endsWith(".html"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const merged = await PDFDocument.create();

for (const file of slides) {
  const page = await ctx.newPage();
  await page.goto(`file://${process.cwd()}/slides/${file}`);
  const pdfBytes = await page.pdf({ width: "1920px", height: "1080px", printBackground: true });
  const tmp = await PDFDocument.load(pdfBytes);
  const pages = await merged.copyPages(tmp, tmp.getPageIndices());
  pages.forEach((p) => merged.addPage(p));
  await page.close();
}

fs.writeFileSync("deck.pdf", await merged.save());
await browser.close();
```

**Single-file deck-stage caveat**: shadow-DOM slot rendering can cause "only first slide exports." Use a per-slide URL fragment (`?slide=N`) and force the active slide before `page.pdf()`, or convert to multi-file before exporting.

## Recovery: Rewriting for Editable PPTX After the Fact

You're already mid-build and the user pivots to "we need editable PPTX." Two imperfect options:

| Option                                    | Cost                                             | When                                                         |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| **Rewrite HTML to satisfy 4 constraints** | 2-3 hours for a typical 15-20 page deck          | Long-term — it's the only path to ongoing one-command export |
| **Hand-write pptxgenjs version**          | 1-2 hours initially + permanent dual-maintenance | One-shot delivery — never edited again                       |

**Always tell the user explicitly** which option you're picking and why. Don't silently choose the maintenance-debt path.

## Position Questions for Each Slide

Same as `hi-fi-prototype-html` — answer these before writing any slide:

- **Narrative role** — hero, transition, data, quote, closer?
- **Viewing distance** — laptop screen at 1m or projector at 10m? Drives font size and density.
- **Visual temperature** — quiet/excited/cool/authoritative/tender? Drives palette and rhythm.
- **Capacity check** — sketch 3 five-second thumbnails. Does it fit? (Most overcrowding is caught here.)

## Anti-Patterns

- ❌ Drawing slide chrome (page numbers, progress bars, titles) inside each slide AND in the deck stitcher → both render, double chrome
- ❌ Using `1920×1080px` units for editable-PPTX target (must be `720pt × 405pt`)
- ❌ One CSS file shared across multi-file slides — defeats the architecture's main benefit (scope isolation)
- ❌ Building visual-rich slides "we can convert to PPTX later" — the 2-3 hour rework is real

## Pairs Well With

- `hi-fi-prototype-html` — same checkpoint discipline (4 position questions, junior pass)
- `brand-asset-protocol` — required for branded decks
- `anti-ai-slop` — slide decks are slop-prone (gradient backgrounds, emoji bullets)
- `playwright` — drives PDF / image-mode PPTX export
