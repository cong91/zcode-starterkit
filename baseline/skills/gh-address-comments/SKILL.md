---
name: gh-address-comments
description: Use when the user asks to review and address GitHub PR comments/threads for the current branch using gh CLI.
version: 1.0.0
tags: [workflow, git, agent-coordination]
dependencies: []
---

# gh-address-comments

Fetch PR comments and review threads, then apply selected fixes.

## When to Use

- User asks to resolve PR review comments
- User wants a numbered list of comment threads to triage

## When NOT to Use

- No open PR associated with current branch
- `gh` is unavailable/auth is missing and user declines auth

## Workflow

1. Check auth: `gh auth status`
2. Fetch comments: `python3 .zcode/skill/gh-address-comments/scripts/fetch_comments.py`
3. Present numbered comment threads with short fix summaries
4. Ask which comments to address
5. Implement only selected fixes and report results
