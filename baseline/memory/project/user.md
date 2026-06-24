---
purpose: User identity, preferences, communication style
updated: 2025-01-06
---

# User Profile

## Identity

- Name: huynhgiabuu
- Git email: buub1309120@gmail.com

## Communication Preferences

- Style: Detailed responses preferred
- Explanations welcome when helpful

## Workflow Preferences

- Git commits: Ask first before committing
- Beads updates: Ask first before modifying task state
- Auto-actions: Disabled - always confirm before state changes

## Technical Preferences

- Runtime: Node.js
- Language: TypeScript
- Linter: oxlint

## Editing Tool Preferences

- **Primary**: `edit` tool (str_replace) and `patch` tool
- **Secondary/Fallback**: `tilth_tilth_edit` (hash-anchored edits) — only when str_replace fails
- **Reading/Search**: `tilth_tilth_read` and `tilth_tilth_search` are fine to use freely

## Rules to Always Follow

- Run `npm run lint:fix` before any commit
- Validate changes with `npm run typecheck`
- Don't modify dist/ directly (it's built output)
- Ask before adding new dependencies
- Ask before changing .opencode/ structure
- Ask before schema changes (zod schemas, config shapes)
- Never commit secrets or .env files
- Never force push to main
