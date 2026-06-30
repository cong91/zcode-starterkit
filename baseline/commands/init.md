---
description: Initialize project — agent-driven local setup, AGENTS.md creation, stack detection. Run once per project.
argument-hint: "[--deep]"
---

# Init: $ARGUMENTS

Initialize this project for ZCode in one agent-driven pass.

This command is a runbook for the agent. Do **not** call any removed legacy project-install shim or package-local installer. The user only runs `/init`; the agent performs the setup steps directly and safely.

## Load Skills

```typescript
skill({ name: "index-knowledge" });
```

## Phase 0: Locate global starterkit baseline

The user should have run `npx zcode-starterkit` once before `/init`. The starterkit packages its baseline into ZCode plugins under the cache root. Locate the core plugin root:

```bash
node -e "const p=require('path').join(require('os').homedir(),'.zcode','cli','plugins','cache','zcode-starterkit','core'); console.log(p)"
```

The core plugin directory (named by version) contains the baseline assets the agent reads during `/init`:

- `<core-plugin>/memory/` — project memory + `_templates/` (scaffolds for `AGENTS.md`, `tech-stack.md`, `project.md`, `user.md`, etc.)
- `<core-plugin>/templates/` — document-authoring templates (`adr.md`, `design.md`, `prd.md`, `proposal.md`, `roadmap.md`, `state.md`, `tasks.md`, ...)
- `<core-plugin>/workflows/` — multi-agent workflow definitions (`audit-pattern.md`, `batch-implement.md`, `deep-research.md`, `development-lifecycle-workflow.md`, `garbage-collection.md`)
- `<core-plugin>/plans/` — reference plan documents (`swarm-protocol.md` + example plans)
- `<core-plugin>/context/` — auto-injected + on-demand context (`git-context.md` is referenced by the default `instructions[]`; `architecture.md` / `fallow.md` are read on demand)
- `<core-plugin>/artifacts/` and `<core-plugin>/dcp-prompts/` — reference-only (read via filesystem / `srcwalk_read`; not materialized into the project)

If the cache root or baseline files do not exist, tell the user to run `npx zcode-starterkit` once globally, then re-run `/init`. Do **not** attempt global install from inside a project.

## Phase 1: Materialize thin `.zcode/` overlay safely

Create only missing deterministic project overlay files. Preserve all existing project state.

Rules:

- Create `.zcode/` if missing.
- Create `.zcode/config.json` if missing, using a minimal project overlay:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    ".zcode/memory/project/user.md",
    ".zcode/memory/project/tech-stack.md",
    ".zcode/memory/project/project.md",
    ".zcode/context/git-context.md"
  ]
}
```

- If `.zcode/config.json` already exists, do **not** overwrite it. If it lacks critical `instructions[]`, propose the additive patch before editing.
- Copy support memory files/directories from `<core-plugin>/memory/` into `.zcode/memory/` using missing-only semantics.
- For `.zcode/memory/project/*.md`, create missing files only. Do **not** overwrite existing memory markdown.
- Materialize the bundled reference dirs into the project overlay using missing-only semantics so the project is self-contained and does not depend on the plugin cache at runtime:
  - `<core-plugin>/templates/` → `.zcode/templates/` (document-authoring templates for `/create`, `/design`, `/plan` artifact output)
  - `<core-plugin>/workflows/` → `.zcode/workflows/` (multi-agent workflow definitions)
  - `<core-plugin>/plans/` → `.zcode/plans/` (reference plans)
  - `<core-plugin>/context/` → `.zcode/context/` (this is what makes the `git-context.md` entry in `instructions[]` resolve — without it every fresh init has a dangling instruction that injects nothing)
- For every materialized dir, copy **missing files only**. Do **not** overwrite project edits to templates/workflows/plans/context on re-init. Existing files win.
- Never create, truncate, replace, or bootstrap `.zcode/memory.db` in `/init`.
- Never touch `.zcode/memory.db-shm`, `.zcode/memory.db-wal`, corrupt DB backups, or recovery logs.

Suggested shell for missing-only support copy if available:

```bash
mkdir -p .zcode/memory/project
cp -Rn "<core-plugin>/memory/." .zcode/memory/ 2>/dev/null || true
# Materialize the bundled reference dirs (missing-only; existing project files win).
for d in templates workflows plans context; do
  mkdir -p ".zcode/$d"
  cp -Rn "<core-plugin>/$d/." ".zcode/$d/" 2>/dev/null || true
done
```

After copy, inspect what exists and fill any missing project markdown files with repo-specific starter content. Existing files win. Confirm `.zcode/context/git-context.md` exists — it is referenced by the default `instructions[]` and must resolve.

## Phase 2: CodeGraph local intelligence

If global starterkit enabled CodeGraph during `npx zcode-starterkit`, use it for this project. If CodeGraph is unavailable or disabled, skip cleanly and report `CodeGraph: skipped`.

When `codegraph` is available:

1. Ensure `.codegraph/` is ignored locally. Prefer `.git/info/exclude`; only edit tracked `.gitignore` if the project already uses it for local tool state and the user approves.
2. Do not index linked worktree clones whose `.git` is a file; report that CodeGraph should be refreshed in the source-origin checkout.
3. Run status-driven refresh:
   - not initialized → `codegraph init .`
   - `reindexRecommended: true` → `codegraph index .`
   - otherwise → `codegraph sync .`
4. Auto-refresh git hooks are optional and must be safe:
   - If `git config --get core.hooksPath` returns a path (Husky/custom hooks), do **not** install hooks unless the advanced opt-in is explicitly enabled.
   - If `.git/hooks/post-merge`, `post-checkout`, or `post-rewrite` already exists and is not starterkit-managed, do **not** overwrite it.
   - If safe, add local hooks that call `codegraph sync .` best-effort and never block git operations.
   - With `--allow-codegraph-hooks`, the agent may append starterkit-managed refresh snippets into the configured hooks path instead of skipping.
5. **Verify and repair CodeGraph MCP registration.** CodeGraph only loads in ZCode when its MCP entry is present in the global config. Do not assume a prior `npx zcode-starterkit` registered it — a past install run with `--skip-codegraph` strips the entry, leaving the CLI installed and the index present but the agent unable to query it. This step closes that gap:
   - Read `~/.zcode/cli/starterkit-state/starterkit-state.json`. If `codegraph.enabled` is `false` (e.g. `reason: "skipped by --skip-codegraph"`), the MCP entry is missing from `~/.zcode/v2/config.json` — repair it.
   - Check the global config directly: read the `mcp.codegraph` entry from `~/.zcode/v2/config.json`. It must exist with a shape like `{ command: [<codegraph-path>, "serve", "--mcp"], enabled: true, timeout: 120000, type: "local" }`.
   - If the entry is missing **or** `codegraph.enabled` is `false` in starterkit-state, repair by re-running the global installer without the skip flag:
     ```bash
     npx zcode-starterkit install --with-codegraph
     ```
     This is idempotent (additive merge + backup) and re-registers the `codegraph` MCP entry into `~/.zcode/v2/config.json`, restoring `codegraph.enabled: true` in starterkit-state. Do **not** hand-edit the config JSON — the installer is the single source of truth for the entry shape.
   - If the `codegraph` CLI itself is missing (not on PATH, `codegraph --version` fails), do not attempt to register the MCP entry. Instead report the blocker and tell the user to run `npm install -g @colbymchenry/codegraph`, then re-run `/init`.
   - After repair, re-read the global config and confirm `mcp.codegraph` is present. Report `CodeGraph MCP: registered ✓ (zcode v2/config.json)` or, on failure, `CodeGraph MCP: registration failed — <reason>`.

## Phase 3: Detect project

Detect and validate:

- Package manager and dependency versions
- Build/test/lint/dev commands — validate each actually works when practical
- CI/CD configuration
- Existing AI rules (`AGENTS.md`, `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`, `.zcode/`)
- Top-level directory structure

With `--deep`: also analyze git history, source patterns, and subsystem candidates.

## Phase 3.5: Guideline synthesis

Turn repo signals into a compact, stack-aware rule set before writing `AGENTS.md`.

1. Collect synthesis inputs:
   - detected language, framework, package manager, and scripts
   - existing repo rules (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, `.zcode/`)
   - repo docs (`README.md`, architecture docs, ADRs, tests)
   - local LLM Wiki coding-standard pages for the matching stack
   - the agent-facing `agent-skills-standard` catalog (`skills/index.json`, `skills/*/_INDEX.md`, `README.md`, matching `SKILL.md` files) if available locally or as a reachable checkout
   - optional external catalogs only after the agent-skills-standard catalog has been consulted
2. Score the candidate guidance:
   - **strong** = exact stack/surface match
   - **medium** = same language/runtime or adjacent surface
   - **weak** = generic advice; use only if it changes behavior
   - **ignore** = duplicates or conflicts with higher-priority repo rules
3. Establish the mandatory **Core Coding Contract** first. This contract is present for every project, even when no strong stack-specific pack exists:
   - read repo instructions, docs, configs, and nearby code before editing
   - prefer existing patterns and the smallest correct diff
   - preserve public APIs, data shapes, migrations, and external side effects unless explicitly approved
   - do not add new dependencies, frameworks, broad refactors, or generated churn unless the task requires them
   - use the repo's actual formatter/linter/typecheck/test/build commands; run the relevant ones after meaningful changes
   - self-review the diff, including untracked files, and remove debug leftovers before completion
   - report skipped verification with reasons instead of claiming unverified success
4. Layer stack-specific guidance under the core contract:
   - translate selected `agent-skills-standard` packs into concrete repo-local coding rules
   - include only rules that would change an agent decision in this repo
   - prefer exact command/file/boundary wording over generic best-practice summaries
   - stack packs supplement the core contract; they never replace repo-local instructions or safety rules
5. Draft `AGENTS.md` in this order:
   - Purpose / one-line repo identity
   - Reading order / source-of-truth hierarchy
   - Stack + toolchain
   - Core Coding Contract
   - Selected stack-specific guideline packs
   - Verified commands
   - Repo-specific coding rules (3-7 bullets)
   - Boundaries / gotchas
   - Small code example from the actual codebase
   - Open questions / next step
   - Source notes: which stack packs and wiki pages informed the rules
6. Synthesize, don't paste:
   - distill the selected guidance into a few repo-local rules
   - prefer rules that name the repo's real commands, files, and boundaries
   - exclude generic advice that applies everywhere
   - if a rule already lives in a higher-priority repo file, omit it here unless the project needs a shorter reminder for agents
7. Resolve conflicts by priority:
   - project repo rules win
   - then authoritative local docs / wiki guidance
   - then agent-skills-standard packs
   - then baseline starterkit defaults
   - then other external catalogs
8. If no strong match exists:
   - write a minimal `AGENTS.md` with the Core Coding Contract, detected stack, verified commands, and a note that no strong stack-specific guideline pack was found yet
9. Default pack families by detected stack:
   - Node.js / JavaScript CLI or library: `common/common-best-practices`, `common/common-code-review`, `javascript/javascript-language`, `javascript/javascript-tooling`, `common/common-context-optimization`
   - TypeScript: add `typescript/typescript-language`, `typescript/typescript-tooling`, `typescript/typescript-best-practices`; add `typescript/typescript-security` when auth, secrets, or input validation are relevant
   - Frontend / browser UI: add `common/common-accessibility`, `react/react-hooks`, `react/react-component-patterns`, `react/react-testing`, plus the matching framework pack (e.g. `nextjs/*`, `angular/*`, `react-native/*`)
   - API / backend services: add `common/common-api-design`; if schema or SQL files are present, add `database/database-postgresql` or `database/database-schema-design`; if auth / secrets are present, add the matching security pack
   - Python: `common/common-best-practices`, `python/*`-equivalent packs from the catalog, plus Shell/Git docs
   - Go: `golang/*` packs plus `common/common-best-practices` and `common/common-code-review`
   - Rust: `common/common-best-practices`, `common/common-code-review`, `rust/*`
   - Android / iOS / mobile: add the platform-specific pack family and accessibility/design-system packs where applicable
10. For this repository's current shape (Node.js CLI / JavaScript ESM):
   - treat `common/common-best-practices`, `common/common-code-review`, `javascript/javascript-language`, `javascript/javascript-tooling`, `common/common-context-optimization`, `common/common-architecture-audit`, `common/common-api-design` (only if API surfaces exist), and `common/common-accessibility` (only if UI surfaces exist) as the default strong pack set
   - ignore TypeScript and frontend packs unless the repo actually contains them
   - anchor verification to `node --test`, `npm test`, and `npm pack --dry-run`
11. If a pack family is optional rather than strong:
   - include it only when it changes a rule the agent will actually follow here
   - otherwise leave it out to keep `AGENTS.md` short and specific

## Phase 4: Synthesize and write `AGENTS.md`

1. Read the scaffold first:

```typescript
Read({ filePath: ".zcode/memory/_templates/agents.md" });
```

2. Fill it with the discovered repo facts and the synthesized guideline pack:
   - repo identity and source-of-truth hierarchy
   - stack + toolchain + verified commands
   - the mandatory Core Coding Contract plus stack-specific extensions
   - 3-7 repo-specific rules that are actually needed here
   - one short code example from the current codebase
   - boundaries / gotchas / open questions
   - source notes naming the exact wiki pages or external catalogs that influenced the synthesis

3. Turn the selected guidance into concrete repo-local rules:
   - pick the exact pack family for the detected stack/surface from `agent-skills-standard` (`skills/index.json`, `skills/*/_INDEX.md`, and matching `SKILL.md` files)
   - prefer repo-local docs and the selected agent-skill packs over general human-readable guide indexes
   - translate selected guidance into short rules tied to actual files, commands, and constraints in this repo
   - keep the mandatory Core Coding Contract as the baseline, then add stack-specific rules below it
   - keep only rules that would change a real agent decision here

4. Write `./AGENTS.md` additively:
   - keep the file concise (target <60 lines when possible)
   - preserve any existing human notes that are still correct
   - only replace stale synthesized sections, not the whole file

5. Follow the `index-knowledge` format and keep the output actionable:
   - Tech stack with versions
   - File structure
   - Commands verified
   - Code example from actual codebase
   - Testing conventions
   - Boundaries / gotchas
   - Core Coding Contract
   - Stack-matched guideline pack summary
   - Source notes for the selected guidance pack

If `AGENTS.md` already exists, improve it additively. Do not overwrite blindly.

## Phase 5: Update project memory additively

Update `.zcode/memory/project/tech-stack.md` and `.zcode/memory/project/project.md` with detected facts, but preserve existing human notes. Prefer appending or narrowly patching stale sections over full rewrites.

## Phase 6: Verify and report

Verify:

- [ ] `.zcode/` overlay exists and no existing memory DB was touched
- [ ] Missing project memory files were created; existing memory markdown was preserved
- [ ] `.zcode/context/git-context.md` exists (the default `instructions[]` entry resolves — no dangling instruction)
- [ ] `.zcode/templates/`, `.zcode/workflows/`, `.zcode/plans/` were materialized (missing-only); existing project files preserved
- [ ] CodeGraph refreshed or explicitly skipped/unavailable
- [ ] CodeGraph MCP registered in `~/.zcode/v2/config.json` (repaired via `npx zcode-starterkit install --with-codegraph` if missing)
- [ ] AGENTS.md is created/updated safely
- [ ] Project commands were detected and validated where practical

Output:

1. Overlay result: created/preserved files
2. Memory DB safety: confirm untouched
3. Materialized reference dirs: templates/ workflows/ plans/ context/ (created/preserved counts)
4. CodeGraph result: indexed + MCP registered ✓ (zcode v2/config.json) / skipped / warn (include the repair action taken if the MCP entry was missing)
5. Files created/updated
6. Commands validated
7. **Starterkit commands available** (installed globally by `npx zcode-starterkit`; if any are not yet visible in the ZCode command palette, restart ZCode so the plugin loader re-reads `installed_plugins.json`):

   `audit`, `compound`, `create`, `curate`, `design`, `explore`, `fix`, `gc`, `handoff`, `health`, `init-context`, `init-user`, `iterate`, `lfg`, `plan`, `pr`, `research`, `resume`, `review-codebase`, `ship`, `start`, `status`, `structural-check`, `ui-review`, `ui-slop-check`, `verify`

8. Suggested next steps: `/init-user`, `/init-context`, `/review-codebase`
