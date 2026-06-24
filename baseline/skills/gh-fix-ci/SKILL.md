---
name: gh-fix-ci
description: Use when a user asks to diagnose or fix failing GitHub PR checks in GitHub Actions using gh CLI and logs.
version: 1.0.0
tags: [debugging, devops, git]
dependencies: []
---

# gh-fix-ci

Diagnose failing PR checks, extract actionable logs, and propose focused fixes.

## When to Use

- User asks to fix failing GitHub PR checks
- CI failures are in GitHub Actions

## When NOT to Use

- Checks are from external providers (Buildkite/Circle/etc.) without actionable logs in GitHub
- No `gh` auth and user does not want to authenticate

## Workflow

1. Verify auth: `gh auth status`
2. Resolve PR (`gh pr view --json number,url`) or use provided PR number/URL
3. Run check inspector script
4. Summarize failing checks and log snippets
5. Propose fix plan and implement
6. Re-run relevant checks

## Script

```bash
python3 .opencode/skill/gh-fix-ci/scripts/inspect_pr_checks.py --repo . --pr 123
```

Add `--json` for machine-friendly output.
