---
description: Review UI/UX design for quality, aesthetics, and best practices
argument-hint: "<image-or-component-path> [--responsive] [--dark-mode]"
model: proxypal/gemini-3-pro-preview
---

# UI Review: $ARGUMENTS

## Load Skills

```typescript
skill({ name: "visual-analysis" }); // Analysis framework
skill({ name: "accessibility-audit" }); // WCAG checklists
skill({ name: "frontend-design" }); // Anti-patterns, design quality
skill({ name: "ux-quality-gates" }); // IA, heuristics, forms, recovery, state coverage
```

## Input

Parse `$ARGUMENTS`:

- **Path** (required): Image, screenshot, or component file
- **`--responsive`**: Include responsive breakpoint review
- **`--dark-mode`**: Include dark mode review

## Review Workflow

### 1. Analyze the Input

Use the `visual-analysis` skill to perform deep analysis:

- Content inventory (elements, text, icons)
- Visual properties (colors, typography, spacing, layout)
- Design patterns and potential issues

### 2. Usability Heuristic Pass

Apply `ux-quality-gates` before visual scoring. Check:

- System status is visible for async or multi-step work
- Labels and navigation use user vocabulary, not implementation terms
- Users can cancel, undo, go back, retry, or recover from failure
- Controls, names, and layouts are consistent across the surface
- Dangerous or invalid actions are prevented before they happen
- Options and relationships are visible without relying on memory
- High-volume workflows expose efficient paths where appropriate
- Empty/loading/error/success states are present and useful

Any failure that blocks task completion or recovery is **Critical**, even if the screen looks polished.

### 3. Score Categories

Rate each 1-10 with brief justification:

| Category                          | What to Evaluate                                               |
| --------------------------------- | -------------------------------------------------------------- |
| **Information Architecture**      | User vocabulary, scope clarity, relationships, navigation      |
| **Task Flow & Recovery**          | Primary action, cancellation, undo/retry, error recovery       |
| **Forms & Data Interaction**      | Labels, helper text, validation, selection, bulk actions       |
| **Typography**                    | Hierarchy, readability, weight contrast, intentional choices   |
| **Color**                         | Palette cohesion, contrast, semantic usage, no AI slop         |
| **Layout & Spacing**              | Visual hierarchy, consistency, alignment, white space          |
| **Interactive States**            | Hover, focus, active, disabled, loading/error/success coverage |
| **Accessibility & Semantic HTML** | WCAG AA compliance, native semantics, keyboard/focus behavior  |
| **Component Consistency**         | Shared token DNA: radius, height, border, shadow, states       |
| **Visual Polish**                 | Consistency, attention to detail, motion, shadows, icons       |

### 4. Conditional Reviews

**If `--responsive`**: Check at 375px, 768px, 1280px, 1536px+. Flag touch targets, horizontal scroll, text sizing.

**If `--dark-mode`**: Check contrast on dark backgrounds, adapted colors (not just inverted), shadow adjustments, focus visibility.

### 5. Report Findings

Group by severity:

- **Critical (Must Fix)**: Accessibility failures, broken interactions, dead-end errors, unsafe destructive actions
- **Warning (Should Fix)**: AI slop patterns, inconsistent spacing, missing states, confusing IA/naming
- **Info (Nice to Have)**: Polish opportunities

For each finding: location, impact, and recommended fix.

## Output

Deliver:

1. Category scores (1-10 each) with justification
2. Overall assessment (1-2 sentences)
3. Findings grouped by severity with actionable fixes
4. Code fixes for critical issues (if reviewing component code)

## Record Findings

```typescript
observation({
  type: "warning",
  title: "UI: [Component] [issue type]",
  narrative: "Found [issue] in [location]. Impact: [description]...",
  concepts: "ui, accessibility, [category]",
  confidence: "high",
});
```

## Related Commands

| Need                | Command   |
| ------------------- | --------- |
| Design from scratch | `/design` |
| Ship implementation | `/ship`   |
