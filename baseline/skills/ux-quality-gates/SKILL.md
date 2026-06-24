---
name: ux-quality-gates
description: Use when designing, reviewing, planning, or shipping user-facing UI where UX correctness matters — applies information architecture, usability heuristics, forms, recovery, loading states, semantic HTML, and component consistency checks.
version: 1.0.0
tags: [ui, design, code-quality]
dependencies: []
---

# UX Quality Gates

## Overview

UX quality is not visual polish. A screen passes only when users can understand scope, complete the primary task, recover from errors, and use it with keyboard/screen reader support.

This skill consolidates high-signal UX review patterns into gates for `/design`, `/ui-review`, `/ui-slop-check`, `/plan`, and `/ship`.

## When to Use

- Designing or reviewing user-facing components, pages, dashboards, forms, or flows.
- Planning UI PRDs that include loading, error, empty, success, destructive, or async states.
- Auditing changed UI files before shipping.
- Checking enterprise/data-heavy UIs with selection, bulk actions, filters, or tables.

## When NOT to Use

- Backend-only work.
- Pure visual asset generation with no interaction or user flow.
- Trivial copy/color tweaks where no behavior, state, or structure changes.

## Core Gates

| Gate                     | Pass Condition                                                              | Failure Signals                                                                  |
| ------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Information architecture | UI names match user vocabulary; scope and relationships are visible         | Engineer terms, mixed synonyms, hidden side effects                              |
| Primary action           | One dominant action per view/section                                        | Multiple filled buttons, equal cancel/confirm, destructive action beside primary |
| Forms                    | Label, helper, validation, and error wiring are explicit                    | Placeholder-as-label, errors not associated, disabled submit hiding issues       |
| Recovery                 | Every failure path offers retry, undo, fallback, or support                 | Dead-end errors, disappearing error toasts, no rollback for optimistic UI        |
| State coverage           | Empty/loading/error/success states exist and match final layout             | Global spinner, mismatched skeleton, no no-results state                         |
| Accessibility            | WCAG 2.2 AA baseline, keyboard path, focus, semantic HTML                   | No skip path, focus trap, unlabeled controls, ARIA replacing native HTML         |
| Semantic web             | Correct landmarks/headings/native controls; SEO only when page is indexable | Div buttons, multiple h1s, missing route focus/scroll handling                   |
| Component family         | Shared token DNA across related components                                  | One-off radius/color/height/shadow, inconsistent focus/error states              |

## Usability Heuristic Pass

Check every UI against these ten questions:

1. **System status** — Does the UI show what is happening now?
2. **Real-world language** — Does copy use user vocabulary, not implementation terms?
3. **User control** — Can users cancel, undo, go back, or recover?
4. **Consistency** — Are names, controls, and patterns reused consistently?
5. **Error prevention** — Are dangerous or invalid actions prevented before they happen?
6. **Recognition over recall** — Are options, context, and relationships visible?
7. **Efficiency** — Are shortcuts or bulk actions available where volume requires them?
8. **Minimalism** — Is each visible element serving the current task?
9. **Error recovery** — Does error copy say what happened, why, and how to fix it?
10. **Help** — Is guidance present where users may be stuck?

## Pattern Rules

### Destructive Actions

Require confirmation for permanent deletion, bulk destructive actions, permission/security changes, billing/account scope changes, and irreversible workflow transitions.

Confirmation anatomy:

- Title names the entity/action specifically.
- Body lists concrete consequences.
- Primary label is explicit, e.g. `Delete project`, not `OK` or `Yes`.
- Cancel is easy and default-focused.
- Highest-risk actions require typing the entity name.

Prefer undo for low-stakes reversible actions.

### Forms

- Labels are always visible; placeholders are examples only.
- Helper text explains expected input or consequences.
- Validate on blur by default; use debounced real-time validation for complex fields.
- Submit catches all errors and moves focus/scroll to the first error.
- Use `aria-describedby`, `aria-invalid`, and `role="alert"` for errors.
- Required/optional marker shows the minority case.
- Use correct `type`, `autocomplete`, `fieldset`, and `legend`.
- Disable submit only for short forms where all validity is visible; otherwise allow submit and show errors.

### Loading and Async States

| Wait | Pattern                                      |
| ---- | -------------------------------------------- |
| <1s  | Inline spinner or optimistic update          |
| 1-3s | Skeleton matching final layout               |
| >3s  | Determinate/progressive status when possible |

- Button loading prevents duplicate submit without shifting layout.
- Skeletons are recessive and match final dimensions.
- Optimistic updates must have rollback.
- Error toasts persist until dismissed or replaced by a visible recovery path.

### Notifications and Recovery

- Success toast: auto-dismiss after 4-6s unless action is needed.
- Error toast/banner: persists until resolved or dismissed.
- Toasts have at most one action.
- Inline errors live beside the affected control.
- Failed sections degrade locally instead of blanking the whole app.
- Transient failures get retry; repeated failures escalate to support or alternative path.

### Data Display and Selection

Use for data-heavy UIs only:

- Offer grid/list/table only when each view changes task value.
- Persist view choice when useful.
- Selection supports row/card click, checkbox indicator, keyboard Space, and range selection where expected.
- Bulk action toolbar shows selected count.
- Destructive bulk actions name the count and scope.
- Distinguish filtered no-results from genuinely empty state.
- Tables may need sticky headers/first column, row actions, and resize/reorder for enterprise density.

## Review Output

When reporting findings, include:

- Gate name.
- Severity: Critical, Warning, or Info.
- Location with `file:line` when reviewing code.
- User impact.
- Concrete fix.

## Common Mistakes

| Mistake                                 | Fix                                                              |
| --------------------------------------- | ---------------------------------------------------------------- |
| Treating UX as aesthetics               | Check task completion, recovery, and state coverage first        |
| Adding every UX rule to every task      | Apply data/table/SEO rules only when relevant                    |
| Using ARIA to patch non-semantic markup | Prefer native elements, add ARIA only when semantics are missing |
| Making errors transient                 | Persistent errors need persistent recovery                       |
| Importing many overlapping skills       | Use this consolidated gate and existing design/a11y skills       |
