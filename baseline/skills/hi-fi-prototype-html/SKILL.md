---
name: hi-fi-prototype-html
description: Use when building high-fidelity HTML prototypes, interactive product mockups, app/iOS/Android screen demos, or design-variation explorations (NOT production web apps — use frontend-design for that). Enforces Junior Designer mode (show assumptions early, iterate), single-file inline React for double-clickable mockups, real images instead of generic placeholders, and Playwright click-test before delivery.
---

# Hi-Fi Prototype (HTML as Medium)

> Adapted from `huashu-design`. HTML is your **medium**, not your destination. You are a designer who happens to use HTML, not a developer who happens to be designing.

## When to Use

- **Interactive prototypes** — clickable product mockups for user testing or design review
- **Design variation exploration** — 3+ side-by-side directions before committing
- **App / iOS / Android mockups** — single-page or full-flow demos
- **Concept demos** — convey an interaction or feel before any production code
- **Information graphics** with hand-tuned typography

**Don't use for**:

- Production web apps with real backends → `frontend-design` + `react-best-practices`
- SEO/marketing sites → `frontend-design`
- Component library work → `mockup-to-code` (mockup → production component)

## Core Discipline

### 1. Start From Existing Context — Don't Design From Air

Good hi-fi designs grow from existing context. Before opening a blank file:

- Ask: do you have a design system / UI kit / Figma / brand site / reference screenshots?
- If yes → run `brand-asset-protocol` to extract real assets
- If no AND brief is vague → run `design-direction-advisor` first
- Only as last resort: design from generic intuition (will produce AI slop — see `anti-ai-slop`)

### 2. Junior Designer Mode — Show Assumptions Early, Then Iterate

You are the user's junior designer. The user is the manager.

❌ **Don't** disappear for an hour and reveal a finished file.

✅ **Do** open the HTML with your assumptions written as comments + reasoning + grayblock placeholders. Show this **first**. Get nod. Then write components. Show again at 50% done. Iterate.

```html
<!-- Assumptions:
     - Audience: enterprise admins
     - Style direction: Pentagram-style (per design-direction-advisor)
     - 3 variations differ in: density, hierarchy, accent color
     - Real product photos pending from user (Step 1 of brand-asset-protocol)
-->
<div class="placeholder">[Hero image — DJI Pocket 4 product render, TBD]</div>
<div class="placeholder">[Headline copy — TBD from user]</div>
```

**Why**: misunderstanding the brief is 100× cheaper to fix at this stage than after a finished build.

### 3. Give Variations, Not "The Answer"

When the user says "design X", don't deliver one polished answer. Deliver **3+ variations** spanning:

- by-the-book → novel (a continuum, not all in one corner)
- different axes: visual, interaction, color, layout, animation
- let the user mix and match

Implementation:

- Pure visual comparison → side-by-side static layout (`design_canvas`-style grid)
- Interactive flow with branching options → full prototype with toggles ("Tweaks") for live parameter swap

### 4. Honest Placeholders Beat Bad Implementations

- Missing icon? → gray block + label "[icon]". Don't draw a wonky SVG.
- Missing data? → `<!-- TBD: real data from user -->`. Don't fabricate plausible-looking numbers.
- Missing image? → labeled placeholder. Don't AI-draw a face.

**In hi-fi work, an honest placeholder is 10× better than a clumsy attempt at the real thing.**

### 5. System First, Don't Pad Filler

Every element earns its place. Whitespace is a design problem solved by **composition**, not by inventing content.

Especially watch for these "slop" categories (see `anti-ai-slop`):

- **Data slop** — meaningless stats, decorative numbers
- **Iconography slop** — every heading needs an icon
- **Gradient slop** — every background gets a gradient

> "One thousand no's for every yes."

## App / iOS Prototype Rules (override generic placeholder rules)

App mockups are **demos at presentation time** — generic gray rectangles and lorem ipsum kill credibility. Different rules apply:

### A. Architecture: Default to Single-File Inline React

**Default**: all JSX/data/styles inside a `<script type="text/babel">…</script>` tag in one HTML file. Reasons:

- `file://` blocks external JS as cross-origin → forces user to spin up an HTTP server → violates "double-click to open" principle
- Local images must be base64 data URLs (don't assume a server)

**Split files only when**:

- Single file >1000 lines and unmaintainable → split into `components.jsx` + `data.js`, document the `python3 -m http.server` command in delivery notes
- Multiple subagents need to write different screens in parallel → `index.html` + per-screen HTML, iframe-aggregated, each screen self-contained

| Scenario                          | Architecture             | Delivery                                  |
| --------------------------------- | ------------------------ | ----------------------------------------- |
| Single dev, 4-6 screens (default) | Single-file inline React | One `.html`, double-click                 |
| Single dev, large app (>10 scr)   | Multi-jsx + HTTP server  | Include startup command                   |
| Multi-agent parallel              | Multi-HTML + iframe      | `index.html` aggregator, each opens alone |

### B. Real Images First, Not "Just Placeholders"

By default, **actively fetch real images**. Don't draw SVG. Don't leave gray blocks. Don't wait for user to ask.

| Use case                          | Source                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| Art / museum / historical content | Wikimedia Commons (public domain), Met Museum Open Access, AIC API  |
| General lifestyle photography     | Unsplash, Pexels (royalty-free)                                     |
| User's existing assets            | `~/Downloads`, project `_archive/`, user's configured asset library |

Wikimedia caveat: `curl` via TLS proxy often fails. Use Python `urllib` and a compliant User-Agent (`MyProject/0.1 (https://github.com/you; you@example.com)`). Use the MediaWiki API (`action=query&list=categorymembers`) for batch / `prop=imageinfo&iiurlwidth=` for sized thumbs.

**Honest-image test**: before fetching, ask — _"if I remove this image, is information lost?"_

| Scenario                                                     | Verdict                        | Action                                      |
| ------------------------------------------------------------ | ------------------------------ | ------------------------------------------- |
| Essay list cover / profile background / settings page banner | Decoration, no link to content | **Don't add** — equivalent to gradient slop |
| Museum content portrait / product detail / map card location | Image IS the content           | **Must add** — real image required          |
| Graph / visualization background texture (very subtle)       | Atmosphere, not focus          | Add at `opacity ≤ 0.08`                     |

❌ Don't pad text essays with Unsplash "inspiration shots." Permission to use real images ≠ license to over-use them.

### C. Two Standard Delivery Forms — Ask First

Multi-screen app prototypes split into two standard forms. **Ask which one** before defaulting:

| Form                                      | When                                                                    | How                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Overview tile (design review default)** | User wants to see all screens, compare layout, walk through consistency | All screens in parallel, each in its own iPhone frame, no clicks needed             |
| **Flow demo (single device)**             | User wants to demonstrate a specific user flow (onboarding, purchase)   | One iPhone with `AppPhone` state machine — tabs, buttons, annotations all clickable |

Routing keywords:

- "tile / show all pages / overview / compare / all screens" → overview
- "demonstrate flow / user path / walk through / clickable / interactive demo" → flow demo
- Ambiguous → ask. Don't default to flow demo (it's much more work).

**Overview skeleton:**

```jsx
<div style={{ display: "flex", gap: 32, flexWrap: "wrap", padding: 48, alignItems: "flex-start" }}>
  {screens.map((s) => (
    <div key={s.id}>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 8, fontStyle: "italic" }}>
        {s.label}
      </div>
      <IosFrame>
        <ScreenComponent data={s} />
      </IosFrame>
    </div>
  ))}
</div>
```

**Flow demo skeleton:**

```jsx
function AppPhone({ initial = "today" }) {
  const [screen, setScreen] = React.useState(initial);
  const [modal, setModal] = React.useState(null);
  // dispatch to the right ScreenComponent, pass onEnter/onClose/onTabChange callbacks
}
```

Each Screen takes callback props (`onEnter`, `onClose`, `onTabChange`, `onOpen`, `onAnnotation`) — don't hard-code state. TabBar, buttons, cards get `cursor: pointer` + hover feedback.

### D. Click-Test Before Delivery

Static screenshots only show layout. Interaction bugs only surface when you click. Run a **3-action minimum Playwright test** before saying done:

1. Enter detail view
2. Trigger a key annotation
3. Switch tabs

Check `pageerror` count is 0. If not, fix and re-run.

```bash
npx playwright test prototype.spec.ts
```

### E. iOS Frame: Use a Pinned-Spec Component, Don't Hand-Code

The iPhone Dynamic Island has fixed pixel dimensions (124×36, top:12, centered). Hand-coding the bezel + status bar + island + home indicator → 99% chance of placement bugs (status bar items get squeezed by the island, content top-padding miscalculated).

**Rule**: bind to a known-good iOS frame component (e.g. an `IosFrame` you keep in a personal asset library). Don't write `.dynamic-island`, `.status-bar`, `.home-indicator`, or the bezel chrome inline.

```jsx
<IosFrame time="9:41" battery={85}>
  <YourScreen />
</IosFrame>
```

Same rule for Android (`AndroidFrame`), macOS windows (`MacosWindow`), browser windows (`BrowserWindow`).

## Position Questions — Answer Before Designing the System

For every page / screen / shot, answer these **4 position questions** before opening CSS:

- **Narrative role** — hero / transition / data / quote / closer? (every page in a deck differs)
- **Viewing distance** — 10cm phone / 1m laptop / 10m projector? (drives font size + density)
- **Visual temperature** — quiet / excited / cool / authoritative / tender / mournful? (drives palette + rhythm)
- **Capacity check** — sketch 3 five-second thumbnails on paper. Does the content fit?

Then verbalize the design system (palette / type / layout rhythm / component patterns). System serves the answers — don't pick the system first and stuff content in.

🛑 **Checkpoint**: state the 4 answers + the system out loud. Wait for user nod **before** opening CSS.

## Standard Workflow (with Checkpoints)

1. **Understand the need.**
   - 🔍 If task names a specific real product (DJI Pocket 4, Gemini 3 Pro, etc.): WebSearch first, write facts to `product-facts.md`. Don't guess from memory.
   - Ask focused clarifying questions — batch them, don't drip-feed.
   - 🛑 **Checkpoint 1**: send all questions, wait for user to answer in batch.
   - 🛑 If brief is vague → run `design-direction-advisor` and complete Phase 1-4 first.

2. **Explore resources + extract assets.** Read design system, linked files, screenshots. For specific brands: run `brand-asset-protocol` (5 steps).
   - 🛑 **Checkpoint 2 (asset self-check)**: physical product → product photo present (not CSS silhouette); digital product → logo + UI screenshot present; colors extracted from real HTML/SVG. Missing → stop and fix.

3. **Answer the 4 position questions, then verbalize the system.**
   - 🛑 **Checkpoint 3**: state position answers + system. Wait for nod.

4. **Build folder structure.** `<project-name>/` holds main HTML + needed asset copies (don't bulk-copy >20 files).

5. **Junior pass.** HTML opens with assumptions + placeholders + reasoning comments.
   - 🛑 **Checkpoint 4**: show early (gray blocks + labels are fine). Wait for feedback before writing components.

6. **Full pass.** Fill placeholders, build variations, add Tweaks if needed. **Show again mid-way**, not only at the end.

7. **Verify.** Playwright screenshot + console error check. Send to user.
   - 🛑 **Checkpoint 5**: open the file in your own browser. Walk through. AI-written prototype code commonly has subtle interaction bugs.

8. **Summary.** Minimal — caveats and next steps only.

**Checkpoint principle**: when you hit a 🛑, stop and explicitly say _"I did X, next I plan Y, confirm?"_ — then **actually wait**. Don't say it and immediately continue.

## Pairs Well With

- `brand-asset-protocol` — extract real brand assets before designing
- `anti-ai-slop` — actively avoid the AI default aesthetic
- `design-direction-advisor` — when brief is too vague to start
- `design-taste-frontend` / `high-end-visual-design` — base aesthetic discipline
- `frontend-design` — when prototype graduates to production code
- `playwright` — for the click-test step
