---
name: security-threat-model
description: Use when the user explicitly requests threat modeling for a repo or path, with concrete abuse paths, trust boundaries, and mitigations.
version: 1.0.0
tags: [planning, code-quality, research]
dependencies: []
---

# security-threat-model

Repository-grounded threat modeling for real attack paths and mitigations.

## When to Use

- User explicitly asks for threat modeling
- User asks for abuse-path analysis, attacker goals, or trust-boundary review

## When NOT to Use

- General code review without threat-model request
- Pure style/refactor requests

## Workflow

1. Scope system/runtime components from repository evidence
2. Enumerate trust boundaries, assets, and entry points
3. Define realistic attacker capabilities
4. Model concrete abuse paths and rank by impact/likelihood
5. Validate assumptions with user (1–3 targeted questions)
6. Recommend mitigations tied to concrete files/components
7. Write final report to `<repo-name>-threat-model.md`

## References

- `references/prompt-template.md`
- `references/security-controls-and-assets.md`
