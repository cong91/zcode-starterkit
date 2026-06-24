---
name: brand-asset-protocol
description: Use when designing anything for a specific brand (logo, marketing site, product launch animation, branded slide deck, redesign). MUST load before producing branded visuals. Forces real logo + product image + UI screenshot fetch BEFORE any design work — color values alone are not enough for brand recognition. Includes 5-10-2-8 quality bar (5 search rounds, 10 candidates, pick 2 best, each ≥8/10).
---

# Brand Asset Protocol

> Adapted from `huashu-design`. Brand recognition lives in **assets first, color second**. Generic CSS shapes can never substitute a real logo or product image.

## When to Use

Trigger this protocol whenever the task names a real brand or product:

- "Design a launch animation for **DJI Pocket 4**"
- "Redesign the **Stripe** dashboard"
- "Build a landing page for **Linear**"
- "Make a slide deck about **Anthropic Claude**"
- Internal client work: "Design something for **our company**"

If the task is generic ("design a SaaS landing page"), skip this skill — use `design-direction-advisor` instead.

## Prerequisite: Verify the Brand Exists First

Before fetching assets, confirm the brand/product **exists and you know its current state**. Never assert from training data — search.

```
Trigger: any specific product/version (Pocket 4, Gemini 3 Pro, new SDK, etc.)
Action: WebSearch "<product> launch date specs 2026" → read 1-3 authoritative results
Cost: 10 seconds. Skipping this can cost 1-2 hours of rework.
```

Forbidden phrases that signal you should search instead of guess:

- ❌ "I think X hasn't launched yet"
- ❌ "X is currently version N" (without checking)
- ❌ "X probably doesn't exist"
- ✅ "Let me search for the latest state of X"

## Asset Hierarchy: Why Color Alone Fails

| Asset                        | Recognition contribution     | Required for                              |
| ---------------------------- | ---------------------------- | ----------------------------------------- |
| **Logo**                     | Highest — instant ID         | **Every** branded project                 |
| **Product photos / renders** | Very high — the "main actor" | Physical products (hardware, packaging)   |
| **UI screenshots**           | Very high — the "main actor" | Digital products (apps, SaaS, dashboards) |
| Color palette                | Medium — easily collides     | Supporting role                           |
| Typography                   | Low — needs the above        | Supporting role                           |
| Vibe keywords                | Low — internal QA only       | Supporting role                           |

**Rule**: Pulling colors + fonts but skipping logo/product/UI → protocol violation. Generic placeholders, CSS silhouettes, or hand-drawn SVG cannot substitute real assets.

## The 5-Step Protocol (Strict Sequence)

### Step 1 — Ask (one full asset checklist, not vague "got brand guidelines?")

Send this exact list:

```
For <brand/product>, which of these do you have? (priority order)
1. Logo (SVG / high-res PNG) — required for any brand
2. Product photos / official renders — required for physical products
3. UI screenshots / interface assets — required for digital products
4. Color values (HEX / RGB / palette doc)
5. Font list (display / body)
6. Brand guidelines PDF / Figma design system / brand site URL

Send what you have; I'll fetch / generate the rest.
```

### Step 2 — Search Official Sources

| Asset           | Where to look                                                                               |
| --------------- | ------------------------------------------------------------------------------------------- |
| **Logo**        | `<brand>.com/brand`, `/press`, `/press-kit`, `brand.<brand>.com`, header inline SVG         |
| **Product img** | Product detail page hero + gallery, official YouTube launch film frames, press releases     |
| **UI**          | App Store / Play Store screenshots, official site screenshots section, demo video frames    |
| **Colors**      | Site inline CSS / Tailwind config / brand guidelines PDF                                    |
| **Fonts**       | `<link rel="stylesheet">` references on official site, Google Fonts trace, brand guidelines |

Fallback queries: `<brand> logo download SVG`, `<brand> press kit`, `<brand> <product> official renders`, `<brand> app screenshots`.

### Step 3 — Download (three fallback paths per asset type)

**Logo (mandatory for every brand):**

```bash
# 1. Direct file (best)
curl -o assets/<brand>/logo.svg https://<brand>.com/logo.svg

# 2. Extract inline SVG from homepage HTML (~80% of cases)
curl -A "Mozilla/5.0" -L https://<brand>.com -o assets/<brand>/homepage.html
# then grep <svg>...</svg> for the logo node

# 3. Official social avatar (last resort): GitHub/Twitter/LinkedIn org image
```

**Product photos (mandatory for physical products):**

1. Official product page hero (right-click image URL, curl it)
2. Official press kit / press releases
3. Launch video frames (`yt-dlp` + `ffmpeg`)
4. Wikimedia Commons (public domain)
5. AI generation **using the official product photo as reference** — never replace with CSS silhouettes

**UI screenshots (mandatory for digital products):**

- App Store / Play Store product page (note: may be marketing mockups, not real UI — verify)
- Official site screenshots section
- Product demo video frames
- Official Twitter/X launch posts (often the latest version)
- Real screenshots from your own account when possible

### Step 4 — Quality Bar: The 5-10-2-8 Rule (non-Logo assets)

> Logo rules differ: any logo must be used (no logo → stop and ask user). Other assets (product photos, UI, hero imagery) follow 5-10-2-8.

| Dimension              | Standard                                                                                                | Anti-pattern                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **5 search rounds**    | Cross-search official site / press kit / social / YouTube / Wikimedia / user account                    | First page of results, stop         |
| **10 candidates**      | Gather at least 10 before filtering                                                                     | Grab 2, no choice                   |
| **Pick 2 best**        | Curate 2 finals from the 10                                                                             | Use everything = visual overload    |
| **Each ≥8/10 quality** | Below 8 → use honest placeholder or AI-generate from official reference. **Better none than mediocre.** | Pad brand-spec.md with 7/10 fillers |

**8/10 scoring dimensions** (record per asset in `brand-spec.md`):

1. **Resolution** — ≥2000px (≥3000px for print/large screen)
2. **Copyright clarity** — official > public domain > free stock > unclear (unclear = 0)
3. **Brand vibe match** — consistent with the vibe keywords in `brand-spec.md`
4. **Lighting/composition consistency** — the 2 finals should not clash
5. **Standalone narrative** — each asset must independently express a narrative role, not just decorate

### Step 5 — Codify in `brand-spec.md` (single source of truth)

```markdown
# <Brand> · Brand Spec

> Captured: YYYY-MM-DD
> Sources: <list>
> Completeness: complete / partial / inferred

## 🎯 Core Assets (first-class)

### Logo

- Primary: `assets/<brand>/logo.svg`
- Inverse: `assets/<brand>/logo-white.svg`
- Use cases: <intro / outro / corner watermark / global>
- Forbidden: <no stretch / no recolor / no outline>

### Product Photos (required for physical products)

- Hero: `assets/<brand>/product-hero.png` (2000×1500)
- Detail: `assets/<brand>/product-detail-1.png`
- Scene: `assets/<brand>/product-scene.png`

### UI Screenshots (required for digital products)

- Home: `assets/<brand>/ui-home.png`
- Feature: `assets/<brand>/ui-feature-<name>.png`

## 🎨 Supporting Assets

### Palette

- Primary: #XXXXXX <source>
- Background: #XXXXXX
- Ink: #XXXXXX
- Accent: #XXXXXX
- Forbidden: <colors the brand explicitly avoids>

### Typography

- Display: <font stack>
- Body: <font stack>
- Mono: <font stack>

### Signature Details

- <which details are taken to 120%>

### Forbidden Zone

- <explicit "do not" rules>

### Vibe Keywords

- <3-5 adjectives>
```

## Execution Discipline (after spec exists)

- **All HTML must reference asset file paths from `brand-spec.md`** — no CSS silhouettes, no hand-drawn SVG substitutes.
- **Logo as `<img>`** referencing the real file. Never redraw.
- **Product photos as `<img>`** referencing real files. No CSS silhouettes.
- **CSS variables injected from spec**: `:root { --brand-primary: ...; }` — HTML only uses `var(--brand-*)`.
- This converts brand consistency from "by intent" to "by structure" — adding a new color requires editing the spec first.

## Failure Fallbacks

| Missing                      | Action                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Logo not findable**        | **Stop and ask the user.** Logo is the foundation of brand recognition. Don't fake it.                                       |
| **Product photo (physical)** | Prefer AI generation **using official reference image** → ask user → honest placeholder ("product photo TBD") as last resort |
| **UI screenshot (digital)**  | Ask user for screenshots from their account → official demo video frames. Don't use generic mockup generators.               |
| **Color values**             | Run `design-direction-advisor` skill, recommend 3 directions with explicit assumption labels                                 |

**Forbidden**: silently using CSS silhouettes / generic gradients when assets can't be found. **Better to stop and ask than to fake.**

## Real Failures (why this protocol exists)

- **Kimi animation**: Guessed "should be orange" from memory. Actual brand color: `#1783FF` blue. Full rework.
- **Lovart design**: Mistook a demo brand color in a product screenshot for Lovart's own. Almost destroyed the entire design.
- **DJI Pocket 4 launch animation**: Pulled colors but skipped logo + product image, used CSS silhouettes. Output was "generic black-bg + orange-accent tech animation" with zero DJI recognition. Designer's note: _"Otherwise, what are we even expressing?"_

## Cost Comparison

| Path                       | Time                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| **Run protocol correctly** | Logo 5 min + product/UI 10 min + color grep 5 min + spec write 10 min = **~30 min** |
| **Skip protocol**          | Generic output → user rework 1-2 hours, sometimes full redo                         |

**The cheapest stability investment in branded design work.** For client deliverables, launch events, or important customer projects, the 30-minute protocol is insurance.
