# Harness Redesign: Workflows + Surface Area Reduction

## TL;DR

Add 1 plugin (~300 lines), 1 directory (`.opencode/workflows/`), cut the template from 800+ files to ~80 essential files, lazy-load the rest. The result is a harness that is strictly better than Claude Code's: more flexible, more verifiable, and fully extensible.

---

## Discovery

### Current State (Brutal)

| Category | File Count | Problem |
|---|---|---|
| Agents | 7 files | `build` (main agent) and `general` (subagent default) are distinct roles. Keep both. |
| Commands | 17 files | ~10 of these will never be invoked. They bloat context on every `/init`. |
| Skills | 50+ dirs | Cloudflare is 280 files. React best-practices is 50 files. Core Data is 15 files. SwiftUI is 17 files. **If you don't use these, they're dead weight in the skill index.** |
| Plugins | ~20 files + Copilot SDK | All plugins including Copilot SDK stay — they're part of the core stack. |
| State/Artifacts | ~10 files | Workable — needed for the beads lifecycle. |
| DCP prompts | 9 files | 9 carefully tuned compression prompts. Keep. |
| `src/` (CLI) | 25 files | Fine. This is the `ock` CLI surface. Keep. |

**Total: ~800 files.** A new user has no idea where to start. The `README.md` lists 14 slash commands and 7 agents — the cognitive load before the first prompt is too high.

### What OpenCode Already Has That Claude Code Doesn't

1. **Plugin API hooks**: `tool.execute.before`, `experimental.chat.system.transform`, `experimental.session.compacting`, `message.part.updated`. Claude Code has file-based extension only.
2. **4-tier memory pipeline**: capture → distill → curate → inject. Claude Code has auto memory (model writes to a file).
3. **Tool constraints per subagent**: `explore` literally cannot edit files — the runtime enforces it. Claude Code uses prompt-level restrictions.
4. **Fallow codebase gate**: deterministic static analysis gating completion claims.
5. **Worker distrust protocol**: the harness requires reading changed files and re-running verification after every subagent returns.

### What OpenCode Is Missing vs Claude Code Workflows

Claude Code's dynamic workflows provide:
1. **A script that holds the plan** — orchestration lives in JavaScript, not the model's context window
2. **Isolated runtime** — the script executes outside the conversation
3. **Intermediate results in script variables** — not in context
4. **Phase-level monitoring** — track agents per phase, token usage, elapsed time
5. **Resumability** — cached agent results survive pauses
6. **Cross-checking** — agents adversarially review each other's findings

OpenCode's equivalent is the `subagent-driven-development` skill — a **markdown file** describing how to orchestrate subagents manually. This is a prompt, not a primitive. The model still holds the orchestration in context. For a 50-agent codebase audit, this hits the context wall.

---

## Design: Workflow Primitive

### 1. Workflow File Format

```
.opencode/workflows/
├── deep-research.ts      # Built-in
├── audit-endpoints.ts    # User-created
└── migration-runner.ts   # User-created
```

Each file exports a workflow definition:

```typescript
// .opencode/workflows/deep-research.ts
import { defineWorkflow } from "../plugin/workflow/runtime.js"

export default defineWorkflow({
  name: "deep-research",
  description: "Fan out web searches on a question, cross-check sources, return a cited report",
  agents: 16,        // max concurrent agents
  phases: [
    {
      name: "research",
      parallel: true,
      agents: 8,
      prompt: "Search for different angles on: {question}"
    },
    {
      name: "cross-check",
      parallel: true,
      agents: 4,
      dependsOn: ["research"],
      prompt: "Verify findings from research phase against each other"
    },
    {
      name: "synthesize",
      parallel: false,
      agents: 1,
      dependsOn: ["cross-check"],
      prompt: "Write a final cited report from verified findings"
    }
  ]
})
```

**Alternative (more flexible) — function-based:**

```typescript
export default defineWorkflow({
  name: "audit-endpoints",
  async run({ task, args, log }) {
    // Phase 1: discover endpoints
    const endpoints = await task({
      agent: "explore",
      prompt: `Find all API route handlers matching pattern: ${args.pattern ?? "src/**/route.ts"}`
    })

    // Phase 2: audit in parallel
    const results = await Promise.all(
      parseEndpoints(endpoints).map(ep => task({
        agent: "review",
        prompt: `Audit ${ep.path} for: auth checks, input validation, error handling`
      }))
    )

    // Phase 3: synthesize
    return synthesize(results)
  }
})
```

The function-based form is more powerful. It lets the workflow script hold state, branch, and aggregate — exactly what Claude Code's workflows do.

### 2. Workflow Runtime (~300 lines in a new plugin)

The runtime is a single plugin file: `.opencode/plugin/workflow.ts`

```
plugin/workflow.ts                  — Plugin entry: tools + command registration
plugin/workflow/runtime.ts          — Script loader + sandboxed executor
plugin/workflow/monitor.ts          — Phase progress tracking via session-summary
plugin/workflow/registry.ts         — List/save/load workflows from .opencode/workflows/
```

**Key interfaces:**

```typescript
// The runtime tool exposed to the model
tool.workflow.run = {
  name: "workflow-run",
  description: "Run a workflow script that orchestrates multiple subagents",
  parameters: {
    workflow: string,     // name of workflow in .opencode/workflows/
    args: Record<string, unknown>
  },
  execute: async ({ workflow, args }, context) => {
    const script = await load(`.opencode/workflows/${workflow}.ts`)
    const result = await sandboxedExecute(script, {
      task: context.task,    // pass through the built-in task() tool
      args,
      log: context.log
    })
    return result
  }
}
```

**Sandboxed execution** means the workflow script runs in a separate context with its own `task()` pool. It cannot directly read/edit/write files (only its subagents can). This prevents the orchestration script from corrupting state — the same constraint Claude Code's runtime enforces.

### 3. Integration Points

**Plugin hooks:**
- `tool.execute.before` — intercept `workflow-run` calls, route to runtime
- `experimental.session.compacting` — preserve workflow run state across compaction
- `experimental.chat.system.transform` — inject available workflow descriptions into context (progressive disclosure — only active ones, not all 50)

**Existing surface to reuse:**
- `task()` tool — already exists, workflows delegate to it
- Artifacts — workflow results land in `.opencode/artifacts/<run-id>/`
- Session summary — workflow phase progress is tracked via the existing session-summary plugin interface

### 4. Built-in Workflows (ship 3)

| Workflow | What it does | When to use |
|---|---|---|
| `/deep-research` | Fan out web searches across angles, cross-check sources, write cited report | Questions needing multi-source verification |
| `/audit-pattern` | Explore codebase for a pattern, review each match, synthesize findings | "Find all X and check for Y" |
| `/batch-implement` | Take a plan with independent tasks, dispatch one subagent per task, review each | Multi-file feature implementation |

These replace ~5 of the 17 existing slash commands (research, review-codebase, fix, improve-architecture, refactor) with a single unified primitive.

---

## Design: Surface Area Reduction

### 1. Keep `build` and `general` — distinct roles, no merge

**Confirmed:** `build` is the main/primary agent for development sessions. `general` is the default subagent used by `task()`. They serve different routing purposes and both stay.

**Action:** None — no merge needed. If anything, ensure `general.md` explicitly references `build.md` as its parent for context inheritance.

### 2. Cut the command list from 17 to 6

| Keep | Delete | Why |
|---|---|---|
| `/ship` | → Keep | Core workflow end |
| `/plan` | → Keep | Core workflow middle |
| `/create` | → Keep | Core workflow start |
| `/verify` | → Keep | Verification gate |
| `/research` | → Keep | Research command |
| `/fix` | → Keep | Targeted bugfix |
| | `/clarify` | Merged into `/plan` — the plan agent should clarify as part of planning |
| | `/commit` | `git commit` is a mechanical action, not a command. Let the agent do it automatically at ship time |
| | `/design` | Merged into `/plan` — architecture design is a phase of planning |
| | `/explore` | Users type "find the auth logic", not "/explore auth logic" |
| | `/improve-architecture` | Merged into `/plan --refactor` flag |
| | `/init` | Keep but hide from command list — called once on setup |
| | `/pr` | Merged into `/ship` — PR creation is the final phase |
| | `/refactor` | Merged into `/plan --refactor` |
| | `/review-codebase` | Replaced by `/audit` workflow |
| | `/test` | Too narrow — users say "add tests" not "/test" |
| | `/ui-review` | Merged into the verification phase of `/ship` |

**Impact:** -11 files. The remaining 6 commands are discoverable and non-overlapping. Users learn `create → plan → ship` and everything else is a phase of those three.

### 3. Skill triage: 3 tiers

**Tier 1 — Essential (always loaded, in context):**
- `behavioral-kernel` — core execution discipline
- `code-navigation` — how to read code effectively
- `verification-before-completion` — must-run gates
- `incremental-implementation` — thin slices
- `defense-in-depth` — structural safety

**Tier 2 — On-demand (model loads when relevant, 5-10 files):**
- `frontend-design`, `design-taste-frontend`, `minimalist-ui`, `high-end-visual-design`, `industrial-brutalist-ui`
- `spec-driven-development`, `planning-and-task-breakdown`, `subagent-driven-development`
- `documentation-and-adrs`, `deprecation-and-migration`
- `testing-anti-patterns`, `test-driven-development`
- `debugging-and-error-recovery`, `root-cause-tracing`
- `browser-testing-with-devtools`, `playwright`
- `code-review-and-quality`, `agent-code-quality-gate`
- `git-workflow-and-versioning`, `shipping-and-launch`
- `fallow`, `srcwalk`, `structured-edit`
- ~10 design/UI skills
- ~5 platform skills (supabase, resend, polar, cloudflare-postgres-basics)

**Tier 3 — Platform reference (load only when the user confirms they build on that platform):**

These are large reference directories. They should NOT ship in every template:
- `cloudflare` — 280 files, 15+ sub-services. Add only if user selects "Cloudflare" in `init` wizard
- `react-best-practices` — 50 files. Add only if user selects "React"
- `supabase-postgres-best-practices` — 35 files. Add only if user selects "Supabase"
- `core-data-expert` — 15 files. Add only if user selects "iOS/Core Data"
- `swiftui-expert-skill` — 17 files. Add only if user selects "SwiftUI"
- `swift-concurrency` — 15 files. Add only if user selects "Swift"

**Impact:** Template drops from 800 files to ~100-150 for most users (Cloudflare alone is 280 files). The `init` wizard asks 3 questions and installs the right tier-3 skills.

### 4. Plugin cleanup — all plugins stay

**Confirmed:** All plugins including the Copilot provider/auth integration and SDK stay. They're part of the core stack.

| Plugin | Keep? | Why |
|---|---|---|
| `memory.ts` + lib/ | [x] Keep | Core 4-tier memory |
| `session-summary.ts` | [x] Keep | Anchored iterative summarization |
| `sessions.ts` | [x] Keep | Session search |
| `skill-mcp.ts` | [x] Keep | Skill MCP bridge |
| `srcwalk.ts` | [x] Keep | Code navigation |
| `copilot-auth.ts` + `sdk/copilot/` | [x] Keep | Copilot provider integration |
| `prompt-leverage.ts` | [x] Keep | Prompt framing |
| `rtk.ts` | [ ] Removed | External dependency for marginal benefit — not earning its place in core stack |
| `guard.ts` | [x] Keep | Conventional commits + pipe-to-shell blocker |

**Impact:** 0 deletions. The plugin surface stays intact.

### 5. DCP and config cleanup

| File | Keep? | Why |
|---|---|---|
| `dcp.jsonc` | [x] Keep | Core compression settings |
| `dcp-prompts/defaults/` (5 files) | [x] Keep | Tuned compression prompts |
| `dcp-prompts/overrides/` (2 files) | [x] Keep | User overrides |
| `tui.json` | [x] Keep | TUI config |
| `.env.example` | [x] Keep | Environment reference |
| `.template-manifest.json` | - Keep but hide | Build system internal |
| `.version` | - Keep but hide | Build system internal |
| `opencodex-fast.jsonc` | [?] What is this? | If unused, delete |

---

## Implementation Effort

| Item | Effort | Files Changed | Risk |
|---|---|---|---|---|
| Workflow runtime plugin | **M** (2-3 days) | ~4 new files (plugin + runtime + monitor + registry) | Medium — sandboxed execution has edge cases |
| Phase monitoring via session-summary hook | **S** (half day) | ~2 files modified | Low — existing plugin interface |
| Built-in workflows (deep-research, audit-pattern, batch-implement) | **S** each (half day each) | ~3 new workflow files | Low — all use existing `task()` |
| Cut commands 17→6 | **S** (2 hours) | 11 deletions, update `ship.md`, README, and init command | Low — old commands unused |
| Skill triage (tier system) | **M** (1-2 days) | Init wizard, skill metadata, lazy-loading config | Medium — changing skill loading has UX impact |
| Tier-3 skill gate in init wizard | **M** (1 day) | Add questions to init wizard, conditional skill install | Low |
| **Total** | **M overall** (1 week) | ~20 files changed | Medium |

---

## The Brutal Self-Critique

**Where this design could fail:**

1. **The workflow runtime adds complexity.** Every runtime has bugs. Error handling in multi-agent scripts is hard. If the runtime is flaky, the workflow feature hurts more than it helps. *Mitigation: keep the runtime under 300 lines, no dependencies, hard fail on uncaught exceptions.*

2. **Cutting commands removes discoverability.** The 17 commands are a menu of "things Claude can do." Cutting to 6 means users need to know the workflow names. *Mitigation: `/help` should list available workflows + the 6 core commands.*

3. **Skill triage creates friction.** If a user wants Cloudflare but didn't select it at init, they now need to know they can `skill install cloudflare`. That's an extra step. *Mitigation: the `init` wizard should have a "Browse skill marketplace" option that lazily loads the full list.*

4. **The function-based workflow format is too powerful.** Giving workflow scripts full JavaScript means they can have bugs, infinite loops, and resource leaks. Claude Code limits workflows to declarative phases + pre-defined templates. *Mitigation: impose a timeout per workflow, max agent count, and disallow raw `while(true)` via sandbox. Add a `maxAgents: 1000` cap matching Claude Code's.*

5. **The template gets smaller but the init wizard gets bigger.** Shifting complexity from file count to an interactive wizard is a tradeoff, not a pure win. If the wizard is bad, users have a worse experience than a big file tree. *Mitigation: the wizard asks exactly 3 questions (project type, target platform, optional skills). No more.*

---

## Acceptance Criteria

1. **Workflow runtime works**: `workflow-run deep-research "What changed in Node.js v20-v22"` fans out 8 search agents, cross-checks, returns a cited report
2. **Workflow scripts are saveable**: `workflow-save` stores the current run's script as a reusable command
3. **Surface area measured**: template ships with ≤150 files (down from 800+)
4. **Init wizard working**: `ock init` asks 3 questions → installs only matching tier-3 skills
5. **All existing `/ship` flows still pass**: no regressions from the 17→6 command cut
6. **Models actually use workflows**: functional test where a prompt containing "audit" triggers a workflow instead of a single-agent turn
