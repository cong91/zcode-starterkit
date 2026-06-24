---
name: anti-ai-slop
description: Use when generating any visual design output (web UI, slides, animations, mockups, infographics) to actively prevent the AI default aesthetic that strips brand identity. Bans purple gradients, emoji-as-icons, rounded-card+left-accent, AI-drawn human SVGs, GitHub-dark `#0D1117`, Inter/Roboto-as-display. Adapted from huashu-design.
---

# Anti AI Slop

> The AI default aesthetic is the **visual common denominator** of all training data. Using it makes every brand look identical. Avoiding it is **brand protection**, not aesthetic snobbery.

## Why This Matters

The reasoning chain:

1. The user wants their brand to be recognizable.
2. AI default output = average of training corpus = all brands blended = **no brand recognized**.
3. So AI defaults dilute the user's brand into "another AI-generated page."
4. Avoiding AI slop is replacing default-mode output with **brand-specific intent**.

Anti-slop is the **defensive** half of design discipline. The **offensive** half is `brand-asset-protocol` (use real logos, real product images, real colors). Both required.

## The Slop Lookup Table

| Pattern                                                | Why it's slop                                                                               | Allowed when                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Aggressive purple gradient**                         | The "tech feel" formula in every SaaS/AI/web3 landing page in training data                 | Brand actually uses purple gradient (some Linear contexts), or task is satire of slop      |
| **Emoji as icon** (`🚀 Fast`, `✨ Magic`)              | "Not professional enough? Add an emoji" disease — symptom of training data                  | Brand uses them (Notion), or audience is kids / casual                                     |
| **Rounded card + left colored border accent**          | 2020-2024 Material/Tailwind cliche, now visual noise                                        | User explicitly asks, or it's in the brand spec                                            |
| **SVG-drawn imagery** (humans, faces, scenes)          | AI-drawn SVG humans always have warped faces, weird proportions                             | **Almost never** — use real images (Wikimedia/Unsplash/AI-generated) or honest placeholder |
| **CSS silhouettes for product photos**                 | Generates "generic tech animation" — black bg + orange accent + rounded bars. Zero brand ID | Almost never — fetch real product photo first (see `brand-asset-protocol`)                 |
| **Inter / Roboto / Arial / system as display font**    | Too common — reader can't tell "designed product" from "demo page"                          | Brand spec uses them (Stripe uses tuned Inter variant)                                     |
| **Cyber neon / GitHub dark `#0D1117`**                 | Copy of GitHub dark mode aesthetic, used everywhere                                         | Developer tools brand that genuinely uses this direction                                   |
| **Generic stock photo "lifestyle" hero on text essay** | Adds no information; pure decoration = slop                                                 | Image is the content (museum portrait, product detail, location card)                      |
| **3+ accent colors**                                   | Multi-color clustering reads as "I couldn't decide"                                         | Data legitimately has ≥3 categorical dimensions                                            |
| **Decorative-icon-on-every-line**                      | "Iconography slop" — pads visual density without information                                | Icon carries differentiating product information (status, type, action)                    |
| **Fabricated stats / fake quotes / lorem ipsum**       | "Data slop" — fills space with meaningless numbers                                          | Never. Ask user for real content or leave honest blank space                               |
| **One generic "page load" animation everywhere**       | Scattered micro-interactions feel cheap                                                     | One well-orchestrated, intentional animation per page                                      |

**Single criterion for allowing any of these**: "the brand spec uses it" or "the task is intentionally about showing slop." Without that explicit reason, default to avoiding.

## What to Do Instead (Positive Patterns)

- ✅ **`text-wrap: pretty`, CSS Grid, advanced CSS** — typography details an AI usually skips. Signals "real designer."
- ✅ **Use `oklch()` or colors from the brand spec.** Never invent new colors mid-design — every invented color erodes brand consistency.
- ✅ **Real images > AI-drawn SVG > HTML/CSS-faked imagery.** Photo first; AI generation second; CSS shapes only when imagery isn't the point.
- ✅ **Typographic curly quotes** ("smart" not "straight") — signal of "this was reviewed."
- ✅ **120% on one detail, 80% on the rest.** Taste = picking the right place to be precise. Even attention everywhere = uniformly bland.
- ✅ **Honest blank > clumsy fill.** A gray block labeled "user avatar" beats an AI-drawn portrait.

## "But the task IS about slop" — Negative Examples Done Right

When the work is showing what _not_ to do (a critique post, a slop-vs-good comparison):

- **Don't fill the whole page with slop.** Containerize the bad sample.
- Use a **dashed border + corner label** "Anti-pattern · do not copy" so the reader can tell intent.
- The negative example serves the narrative; it doesn't pollute the page's primary visual register.

## Self-Check Questions (run before delivery)

For every visual element on the page, ask:

1. **Why is this here?** "It looks nice" is not enough. Each element must earn its place.
2. **Could a different brand use this exact element?** If yes → it's not specific enough.
3. **Did I invent this color/font/shape, or did it come from the brand spec or a real source?**
4. **Is there an icon that adds no information?** Remove it.
5. **Is there a number/stat I made up?** Remove it or get real data.
6. **Is there a gradient that has no brand basis?** Remove it.
7. **Is there an SVG of a human/face I drew?** Replace with real image or honest placeholder.

If any answer fails the test, fix before claiming done.

## Pairs Well With

- `brand-asset-protocol` — the positive counterpart (real assets, brand spec)
- `design-direction-advisor` — when no brand context exists, recommends differentiated directions instead of falling into AI default
- `design-taste-frontend` — base aesthetic discipline for web UI (more prescriptive; this skill is more prohibitive)
- `high-end-visual-design` — premium aesthetic overlay
