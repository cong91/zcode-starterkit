---
name: terse-output-mode
description: Use when the user asks for terse, brief, less-wordy, token-efficient, or caveman-style responses. Applies concise output style while preserving technical precision, verification evidence, safety warnings, and exact code/command/error text.
version: 1.0.0
tags: [workflow]
dependencies: []
---

# Terse Output Mode

## Overview

Terse output mode reduces assistant prose, not tool output or reasoning quality. Use it to answer with fewer words while preserving exact technical substance, safety constraints, and verification evidence.

Default style is professional terse. Use meme-like caveman phrasing only when the user explicitly asks for `caveman mode`.

## When to Use

- User says: "be brief", "less words", "terse", "concise", "token-efficient", "caveman mode", or similar.
- User wants short implementation progress updates.
- User asks for compact status, diff summaries, review findings, or next actions.
- Context pressure is high and user-facing prose can be shortened without losing fidelity.

## When NOT to Use

- Security warnings, secrets handling, destructive actions, or irreversible confirmations.
- PRDs, implementation plans, ADRs, migrations, release notes, or docs where clarity beats brevity.
- Debugging explanations where missing nuance could cause a wrong fix.
- User appears confused, asks for clarification, or repeats a question.
- Verification evidence would be hidden by compression.

## Core Rules

1. **Preserve exact technical content** — never rewrite code, commands, file paths, error strings, versions, numbers, API names, or config keys.
2. **Cut filler first** — remove pleasantries, hedging, throat-clearing, repeated context, and generic reassurance.
3. **Keep evidence** — completion claims still need command output, counts, exit status, or file references.
4. **Prefer fragments when safe** — short noun-verb sentences are fine for status updates.
5. **Cite precisely** — keep `file:line` references when making code claims.
6. **Do not hide uncertainty** — if uncertain, say what is missing in fewer words.
7. **Normal code artifacts** — commits, PR descriptions, docs, specs, and user-facing copy keep normal professional language unless requested otherwise.

## Auto-Clarity Escape Hatch

Temporarily leave terse mode when brevity would create risk:

| Situation                     | Action                                   |
| ----------------------------- | ---------------------------------------- |
| Security or data-loss warning | Use normal explicit wording              |
| Destructive confirmation      | State full impact and options            |
| Multi-step manual instruction | Use numbered complete steps              |
| Ambiguous user intent         | Ask one clear question                   |
| User confusion                | Explain normally, then resume terse mode |

After the risky section, return to terse output automatically.

## Output Patterns

### Status Update

```markdown
Changed `src/auth.ts:42` guard. Typecheck running.
```

### Findings

```markdown
Critical: `src/form.tsx:88` error text is not associated with input. Screen readers miss failure.
Fix: add `aria-describedby`, `aria-invalid`, and `role="alert"`.
```

### Final Report

```markdown
Added optional terse output mode and intent mapping.
`npm run lint` passes: 0 warnings, 0 errors. Typecheck passes.
No commit made.
```

## Boundaries

- This skill is output style only.
- It does not replace `rtk-command-compression`; RTK handles shell/tool output compression.
- It does not replace ZCode compaction/context compression; ZCode compaction handles conversation compression.
- It does not install hooks, plugins, binaries, or dependencies.
- It does not rewrite memory files or project documentation unless explicitly asked.

## Common Mistakes

| Mistake                             | Fix                                                            |
| ----------------------------------- | -------------------------------------------------------------- |
| Making terse mode always-on         | Activate only on user request or clear token-efficiency intent |
| Dropping verification evidence      | Keep fresh command evidence for any completion claim           |
| Rewriting exact errors or commands  | Preserve exact text in code spans                              |
| Using caveman meme voice by default | Default to professional terse                                  |
| Compressing plans/specs too hard    | Use normal detail for durable artifacts                        |
