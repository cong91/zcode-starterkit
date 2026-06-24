---
purpose: Layered architecture rules, dependency direction, and structural enforcement for the template
updated: 2026-06-08
---

# Architecture & Dependency Rules

## Layers

This template follows a layered architecture with strict dependency direction. Each layer can only depend on layers below it.

```
┌────────────────────────────┐
│  1. Instructions           │  AGENTS.md, context/ files, skills
├────────────────────────────┤
│  2. Commands               │  command/ — slash commands (plan, ship, verify, etc.)
├────────────────────────────┤
│  3. Workflows              │  workflows/ — multi-agent orchestration plans
├────────────────────────────┤
│  4. Plugins                │  plugin/ — runtime TypeScript plugins
├────────────────────────────┤
│  5. Tools                  │  tool/ — agent-available tools
├────────────────────────────┤
│  6. SDK                    │  plugin/sdk/ — shared types, interfaces
└────────────────────────────┘
```

## Dependency Rules

| Layer | Can Import From |
|---|---|
| Instructions | Nothing (markdown, self-contained) |
| Commands | Instructions, Skills |
| Workflows | Commands, Instructions, Skills |
| Plugins | SDK only. **Never** from other plugins. |
| Tools | SDK, Plugins (via defined tool interfaces) |
| SDK | Nothing external. Must be self-contained types. |

## Enforcement

These rules are enforced mechanically by the structural check script (`.opencode/tool/structural-check.sh`), which runs during `/verify` and pre-commit.

## Principles

### Plugin Isolation
Each plugin is an independent module. Plugins communicate through defined SDK interfaces, never by importing each other's internal code.

### No Circular Dependencies
If plugin A needs something from plugin B, extract it to SDK. Circular dependencies are prohibited.

### Minimal Surface Area
Keep SDK interfaces small and stable. SDK changes require broader verification.

### File Boundaries
- Plugin files: max 300 lines
- SDK types: max 150 lines
- Command files: max 500 lines
- Workflow files: max 150 lines
