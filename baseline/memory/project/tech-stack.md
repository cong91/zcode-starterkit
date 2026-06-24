---
purpose: Tech stack, constraints, and integrations for AI context injection
updated: 2026-02-24
---

# Tech Stack

This file is automatically injected into ALL AI prompts via `opencode.json` instructions[].

## Framework & Language

- **Framework:** CLI tool (cac for argument parsing)
- **Language:** TypeScript (ESNext, strict mode, bundler moduleResolution)
- **Runtime:** Node.js >= 20.19.0

## Key Dependencies

- **CLI Framework:** cac (^6.7.14) - Command-line argument parsing
- **UI Prompts:** @clack/prompts (^0.7.0) - Interactive CLI prompts
- **Validation:** zod (^3.25.76) - Schema validation
- **Task Tracking:** beads-village (^1.3.3) - Git-backed task management
- **AI SDK:** @ai-sdk/provider (^3.0.6) - AI provider integration

## Build & Tools

- **Build:** tsdown + rsync for template bundling
- **Lint:** oxlint (^1.38.0) - Fast JavaScript/TypeScript linter
- **Format:** oxfmt (^0.23.0) - Code formatter
- **TypeCheck:** tsgo (@typescript/native-preview)
- **Dev Runner:** tsx - TypeScript execution for development

## Testing

- **Unit Tests:** vitest
- **Test Location:** src/\*_/_.test.ts (colocated)
- **Run Single:** vitest src/commands/init.test.ts

## Key Constraints

- Node.js >= 20.19.0 required (engines.node in package.json)
- pnpm for package management
- Build copies .opencode/ to dist/template/ - don't edit dist/ directly
- Keep .opencode/ structure minimal and focused

## Active Integrations

- **OpenCode AI:** @opencode-ai/plugin (^1.1.12) - OpenCode integration
- **Beads CLI:** beads_rust (br) - Task tracking CLI

---

_Update this file when tech stack or constraints change._
_AI will capture architecture, conventions, and gotchas via the `observation` tool as it works._
