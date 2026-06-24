---
name: design-direction-advisor
description: Use when the user's design brief is vague ("make it look good", "design something", "I don't know what style I want", "make me a nice-looking page") OR when no brand context exists. Recommends 3 differentiated directions from 5 design schools × 20 named designer philosophies (Pentagram, Field.io, Kenya Hara, Sagmeister, etc.) with parallel visual demos so the user can choose by seeing, not imagining.
---

# Design Direction Advisor (Fallback Mode)

> Adapted from `huashu-design`. When you don't have brand context and the user's brief is too vague to execute, **don't guess from generic intuition** — that produces AI slop. Convert ambiguity into structured choice.

## When to Trigger

- Vague briefs: "make it look good", "design something", "make me a page", "I don't know what I want"
- User explicitly asks: "recommend a style", "give me some directions", "pick a philosophy", "show me different styles"
- No design context exists: no design system, no brand kit, no Figma, no reference site
- User says "I don't know what style I want either"

## When to Skip

- User already provided clear references (Figma / screenshots / brand spec) → run `brand-asset-protocol` instead
- User already specified the direction ("Apple Silicon launch event style") → go directly to execution
- Small fix or specific tool call ("convert this HTML to PDF") → skip
- Uncertain → use the lightest version: list 3 directions in 2 sentences each and let the user pick. Don't generate demos prematurely.

## The 8-Phase Flow

### Phase 1 — Deep-Understand the Need

Ask up to **3** focused questions (skip if already clear):

- Target audience?
- Core message?
- Emotional tone?
- Output format? (web page / slide / animation / app mockup)

### Phase 2 — Advisor-Style Restatement (~150 words)

In your own words, restate: the essential need, audience, scenario, emotional tone. End with: _"Based on this understanding, I've prepared 3 design directions for you."_

This forces alignment before generation. If the restatement is wrong, the user corrects you cheaply.

### Phase 3 — Recommend 3 Differentiated Philosophies

Each direction must include:

- **Named designer or studio** — "Kenya Hara-style Eastern minimalism," not just "minimalism"
- 50-100 words explaining _why this designer fits your brief_
- 3-4 signature visual features
- 3-5 vibe keywords
- Optional reference work

**Differentiation rule (non-negotiable):** the 3 directions must come from **3 different schools** for clear visual contrast.

### The 5 Schools × 20 Philosophies

| School                               | Vibe                                    | Best as                         | Designers (pick 1 per recommendation)                             |
| ------------------------------------ | --------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| **Information Architecture (01-04)** | Rational, data-driven, restrained       | Safe / professional choice      | Pentagram (Bierut), Stamen Design, Information Architects, Fathom |
| **Motion Poetics (05-08)**           | Dynamic, immersive, technical aesthetic | Bold / cutting-edge choice      | Locomotive, Active Theory, Field.io, Resn                         |
| **Minimalism (09-12)**               | Order, whitespace, refinement           | Safe / premium choice           | Experimental Jetset, Müller-Brockmann, Build, Sagmeister & Walsh  |
| **Experimental Avant-garde (13-16)** | Generative art, visual impact           | Bold / innovative choice        | Zach Lieberman, Raven Kwok, Ash Thorp, Territory Studio           |
| **Eastern Philosophy (17-20)**       | Warm, poetic, contemplative             | Differentiation / unique choice | Takram, Kenya Hara, Irma Boom, Neo Shen                           |

❌ **Forbidden**: recommending 2 or more from the same school. Insufficient differentiation = user can't tell them apart.

A good triplet typically pairs **one safe + one bold + one differentiating** choice.

### Phase 4 — Show Reference Examples (Visual Anchor)

Before generating live demos, **show 2-3 reference images per direction** if you can fetch them (search the designer's known projects). The user calibrates "yes, that vibe" or "no, not what I meant" against real work, not your description.

Phrasing: _"Before I spin up live demos, here's how each style looks in similar scenarios →"_ then show references.

### Phase 5 — Generate 3 Visual Demos

> **Core principle: seeing beats describing.** Don't make the user imagine — show them.

For each of the 3 directions, generate one demo using the user's **real content/topic**, not lorem ipsum.

- **If parallel subagents are supported:** dispatch 3 in parallel (file-disjoint, see AGENTS.md "Parallel Execution Rules")
- **If serial:** generate one at a time, all 3 before showing

| Style type        | Demo path                                                         |
| ----------------- | ----------------------------------------------------------------- |
| HTML-friendly     | Generate full HTML → screenshot via Playwright                    |
| AI-image-friendly | Use image generation (e.g. nano-banana-pro) with style DNA prompt |
| Hybrid            | HTML layout + AI-generated illustrations slotted in               |

Save HTML to `_temp/design-demos/demo-<style>.html`. Screenshot to `_temp/design-demos/demo-<style>.png`. Show all 3 screenshots together.

```bash
# Reference command
npx playwright screenshot file:///<absolute-path>.html out.png --viewport-size=1200,900
```

### Phase 6 — User Chooses

Options to present:

- **Pick one** to deepen
- **Mix** ("A's palette + C's layout")
- **Tweak** specific aspects of one
- **Restart** → return to Phase 3 with refined understanding

### Phase 7 — Generate Production Prompt (if AI image-driven)

Structure: `[design philosophy constraint] + [content description] + [technical params]`

- ✅ Use **specific features**, not style names: "Kenya Hara whitespace + terracotta orange #C04A1A," not "minimalist"
- ✅ Include HEX colors, ratios, space allocation, output spec
- ❌ Avoid AI slop list (see `anti-ai-slop` skill)

### Phase 8 — Hand Off to Main Build

Direction confirmed → return to the main implementation flow (`hi-fi-prototype-html`, `frontend-design`, etc.). You now have **explicit design context** — no longer guessing.

## Lightweight Variant (Time-Pressured)

When the user is in a rush:

- Skip Phase 4 references
- Skip Phase 5 demos
- Just present 3 named directions in 2 sentences each
- Let user pick by name

This trades signal-fidelity for speed but still beats "generic AI default."

## Why This Beats "Just Make a Reasonable Default"

1. **Generic default = AI slop** (see `anti-ai-slop`). It dilutes brand identity to the average of all training data.
2. **Named designer references** give the user concrete vocabulary to push back ("more like Pentagram, less like Sagmeister").
3. **3 differentiated demos** convert vague preferences into testable choices in one round, instead of N rounds of "looks ok but not quite right."
4. **The advisor restatement (Phase 2)** catches misunderstandings before any pixel is committed — the cheapest possible correction point.

## Pairs Well With

- `brand-asset-protocol` — runs **after** direction is locked, when brand assets must be sourced
- `anti-ai-slop` — keeps each demo from collapsing into the AI default
- `hi-fi-prototype-html` — production target after direction is chosen
- `brainstorming` — for non-visual, non-design ambiguity
