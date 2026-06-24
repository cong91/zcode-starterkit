---
description: Ship a bead - implement PRD tasks, verify, review, close
argument-hint: "<bead-id>"
agent: build
---

# Ship: $ARGUMENTS

Execute PRD tasks, verify each passes, run review, close the bead.

> **Workflow:** `/create` → **`/ship <id>`**
>
> Bead MUST have `prd.md`. If not yet claimed, `/ship` auto-claims it.

## Load Skills

```typescript
skill({ name: "beads" });
skill({ name: "memory-grounding" });
skill({ name: "workspace-setup" });
skill({ name: "verification-before-completion" });
skill({ name: "reflection-checkpoints" }); // Mid-point + completion checks during execution
// For user-facing UI changes: skill({ name: "ux-quality-gates" });
// If local web/browser verification needs stable URLs: skill({ name: "portless" });
```

## Determine Input Type

| Input Type | Detection                   | Action                     |
| ---------- | --------------------------- | -------------------------- |
| Bead ID    | Matches `br-xxx` or numeric | Ship that bead             |
| Path       | File/directory path         | Not supported for ship     |
| `all`      | Keyword                     | Ship all in_progress beads |

## Before You Ship

- **Be certain**: Only ship if all tasks pass verification
- **Don't skip gates**: Build, test, lint, typecheck are non-negotiable
- **Run the review**: Always spawn review agent before closing
- **Verify goals**: Tasks completing ≠ goals achieved (use goal-backward verification)
- **Commit before close**: Per-task commits required, don't ship without git history
- **Ask before closing**: Never close bead without user confirmation

## Available Tools

| Tool                 | Use When                                  |
| -------------------- | ----------------------------------------- |
| `explore`            | Finding patterns in codebase, prior art   |
| `scout`              | External research, best practices         |
| `lsp`                | Finding symbol definitions, references    |
| `tilth_tilth_search` | Finding code patterns                     |
| `task`               | Spawning subagents for parallel execution |

## Phase 1: Guards

### Memory Grounding

Follow the [memory-grounding](../skill/memory-grounding/SKILL.md) skill protocol. Focus on: failed approaches to avoid repeating.

### Bead Validation

```bash
br show $ARGUMENTS
```

Verify:

- Bead is `in_progress` or unclaimed (auto-claim if needed)
- `.beads/artifacts/$ARGUMENTS/prd.md` exists (if not, tell user to run `/create` first)

Check what artifacts exist:

Read `.beads/artifacts/$ARGUMENTS/` to check what artifacts exist.

## Phase 1B: Auto-Claim (if not yet in_progress)

If bead status is NOT `in_progress`, auto-claim it:

```bash
br update $ARGUMENTS --status in_progress
```

Then ask about workspace:

### Workspace Setup

Follow the [workspace-setup](../skill/workspace-setup/SKILL.md) skill protocol.

**If bead is already `in_progress`:** Skip this phase entirely.

## Phase 2: Route to Execution

| Artifact exists | Action                                                   |
| --------------- | -------------------------------------------------------- |
| `plan.md`       | Load `executing-plans` skill, follow its batch process   |
| `prd.json`      | Proceed to PRD task loop below                           |
| Only `prd.md`   | Load `prd-task` skill to create `prd.json`, then proceed |

## Phase 3: Wave-Based Execution

If `plan.md` exists with dependency graph:

1. **Load skill:** `skill({ name: "executing-plans" })`
2. **Parse waves** from dependency graph section
3. **Execute wave-by-wave:**
   - Single-task wave → execute directly (no subagent overhead)
   - Multi-task wave → dispatch parallel `task({ subagent_type: "general" })` subagents, one per task
4. **Review after each wave** — run verification gates, report, wait for feedback
5. **Continue** until all waves complete

**Parallel safety:** Only tasks within same wave run in parallel. Tasks must NOT share files. Tasks in Wave N+1 wait for Wave N.

### Phase 3A: PRD Task Loop (Sequential Fallback)

For each task (wave-based or sequential fallback):

1. **Read** the task description, verification steps, and affected files
2. **Read** the affected files before editing
3. **Implement** the changes — stay within the task's `files` list
4. **Handle Deviations:** Apply deviation rules 1-4 as discovered
5. **Checkpoint Protocol:** If task has `checkpoint:*`, stop and request user input
6. **Verify** — run each verification step from the task
7. **If verification fails**, fix and retry (max 2 attempts per task)
8. **Commit** — per-task commit (see below)
9. **Mark** `passes: true` in `prd.json`
10. **Append** progress to `.beads/artifacts/$ARGUMENTS/progress.txt`

### Checkpoint Protocol

When task has `checkpoint:*` type:

| Type                      | Action                                                     |
| ------------------------- | ---------------------------------------------------------- |
| `checkpoint:human-verify` | Execute automation first, then pause for user verification |
| `checkpoint:decision`     | Present options, wait for selection                        |
| `checkpoint:human-action` | Request specific action with verification command          |

**Automation-first:** If verification CAN be automated, MUST automate it before requesting human check.

**Checkpoint return format:**

```markdown
## CHECKPOINT REACHED

**Type:** [human-verify | decision | human-action]
**Progress:** X/Y tasks complete

### Completed

| Task | Commit | Status |
| ---- | ------ | ------ |
| [N]  | [hash] | [✓/✗]  |

### Current Task

**Task:** [name]
**Blocked by:** [specific blocker]

### Awaiting

[What user needs to do/provide]
```

### TDD Execution Flow

When task specifies TDD:

**RED Phase:**

1. Create test file with failing test
2. Run test → MUST fail
3. Commit: `test: add failing test for [feature]`

**GREEN Phase:**

1. Write minimal code to make test pass
2. Run test → MUST pass
3. Commit: `feat: implement [feature]`

**REFACTOR Phase:** (if needed)

1. Clean up code
2. Run tests → MUST still pass
3. Commit if changes: `refactor: clean up [feature]`

### Task Commit Protocol

After each task completes (verification passed):

1. **Check modified files:** `git status --short`
2. **Stage individually** (NEVER `git add .`):
   ```bash
   git add src/specific/file.ts
   git add tests/file.test.ts
   ```
3. **Commit with type prefix:**

   ```bash
   git commit -m "feat(bead-$ARGUMENTS): [task description]

   - [key change 1]
   - [key change 2]"
   ```

4. **Record hash** in progress log

**Commit types:**
| Type | Use For |
|------|---------|
| `feat` | New feature, endpoint, component |
| `fix` | Bug fix, error correction |
| `test` | Test-only changes (TDD RED phase) |
| `refactor` | Code cleanup, no behavior change |
| `chore` | Config, tooling, dependencies |

### Stop Conditions

- Verification fails 2x on same task → stop, report blocker
- Blocked by unfinished dependency → stop, report which one
- Modifying files outside task scope → stop, ask user
- Rule 4 deviation encountered → stop, present options

## Phase 4: Verification

Follow the [Verification Protocol](../skill/verification-before-completion/references/VERIFICATION_PROTOCOL.md):

- Use **full mode** (shipping requires all gates)
- All 4 gates must pass before proceeding to commit/push
- Also run PRD `Verify:` commands

If the PRD requires local web, browser, OAuth callback, webhook, or multi-service verification, load the [portless](../skill/portless/SKILL.md) skill and use approved stable URLs as verification evidence. Portless is optional: read-only `portless list` / `portless get <service>` checks are allowed when installed, but do not install Portless, start proxies, trust CAs, mutate hosts files, clean Portless state, or expose LAN services without explicit user approval.

## Phase 5: Review

```bash
BASE_SHA=$(git rev-parse origin/main 2>/dev/null || git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)
```

### UI Quality Gate (if UI files changed)

Before general review, detect changed UI files:

```bash
git diff --name-only $BASE_SHA...HEAD -- \
  '*.tsx' '*.jsx' '*.css' '*.scss' '*.sass' '*.less' '*.html' '*.mdx'
```

If any UI files changed:

1. Load `skill({ name: "ux-quality-gates" })`.
2. Run `/ui-slop-check auto --since=$BASE_SHA` or manually apply its checklist when slash-command invocation is unavailable.
3. Verify UX gates for changed surfaces:
   - One primary action per view/section
   - Empty/loading/error/success states for async/data flows
   - Retry/undo/confirm paths for errors and destructive actions
   - Form labels, helper text, validation, and error association
   - Semantic HTML, keyboard path, visible focus, reduced motion
   - Component family consistency for related controls
4. Treat Critical findings like review Critical findings: fix inline, rerun verification, then continue.

Load and run the review skill:

```typescript
skill({ name: "requesting-code-review" });
```

Run **5 parallel agents**: security/correctness, performance/architecture, type-safety/tests, conventions/patterns, simplicity/completeness.

Fill placeholders:

- `{WHAT_WAS_IMPLEMENTED}`: bead title + brief summary of what changed
- `{PLAN_OR_REQUIREMENTS}`: `.beads/artifacts/$ARGUMENTS/prd.md`
- `{BASE_SHA}` / `{HEAD_SHA}`: from above

Wait for all 5 agents to return. Synthesize findings.

**Auto-fix rule:**

- Critical issues → fix inline, re-run Phase 4 verification, continue
- Important issues → fix inline, continue
- Minor issues → add to bead comments, note for `/compound` step

If review finds critical issues that require architectural decisions → stop → present options to user.

### Goal-Backward Verification (if plan.md exists)

Verify that tasks completed ≠ goals achieved:

**Three-Level Verification:**

| Level              | Check                  | Command/Action                                                    |
| ------------------ | ---------------------- | ----------------------------------------------------------------- |
| **1: Exists**      | File is present        | `ls path/to/file.ts`                                              |
| **2: Substantive** | Not a stub/placeholder | `grep -v "TODO\|FIXME\|return null\|placeholder" path/to/file.ts` |
| **3: Wired**       | Connected and used     | `grep -r "import.*ComponentName" src/`                            |

**Key Link Verification:**

- Component → API: `grep -E "fetch.*api/|axios" Component.tsx`
- API → Database: `grep -E "prisma\.|db\." route.ts`
- Form → Handler: `grep "onSubmit" Component.tsx`
- State → Render: `grep "{stateVar}" Component.tsx`

**Stub Detection:**
Red flags indicating incomplete implementation:

```javascript
return <div>Component</div>      // Placeholder
return <div>{/* TODO */}</div>    // Empty
return null                       // Empty
onClick={() => {}}                // No-op handler
fetch('/api/...')                 // No await, ignored
return Response.json({ok: true})  // Static, not query result
```

If any artifact fails Level 2 or 3 → fix → re-verify.

## Phase 6: Close

Ask user before closing:

```typescript
question({
  questions: [
    {
      header: "Close",
      question: "All tasks pass, gates green, review clean. Close bead $ARGUMENTS?",
      options: [
        { label: "Yes, close it (Recommended)", description: "All checks passed" },
        { label: "No, keep open", description: "Need more work" },
      ],
    },
  ],
});
```

If confirmed:

```bash
br close $ARGUMENTS --reason "Shipped: all PRD tasks pass, verification + review passed"
br sync --flush-only
```

Record significant learnings with `/compound $ARGUMENTS` after closing.

## Output

Report:

1. **Execution Summary:**
   - Tasks completed/total
   - Waves executed (if plan.md with waves)
   - Deviations applied (Rules 1-3)
   - Checkpoints encountered (human-verify/decision/human-action)
   - Commits made

2. **PRD Task Results:**
   - Each task status (✓ pass, ✗ fail, ⏸ checkpoint)
   - Files modified per task
   - Commit hashes

3. **Verification Gate Results:**
   - Build: [pass/fail]
   - Test: [pass/fail]
   - Lint: [pass/fail]
   - Typecheck: [pass/fail]

4. **Goal-Backward Verification:**
   - Artifacts verified: [N] exists, [M] substantive, [K] wired
   - Key links checked: [pass/fail per link]
   - Stubs detected: [N] (if any)

5. **Review Summary:**
   - Critical issues: [N]
   - Important issues: [N]
   - Minor issues: [N]
   - Overall assessment: [pass/needs work]

6. **Next Steps:**
   - `/pr` to create pull request
   - Manual commits if not already done
   - Create follow-up beads for deferred work

## Related Commands

| Need        | Command   |
| ----------- | --------- |
| Create spec | `/create` |
| Create PR   | `/pr`     |
