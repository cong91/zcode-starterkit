---
name: agent-evals
description: Use when adding/changing a skill, command, or agent prompt and you want evidence it actually helps — not just intuition. Defines bounded-task evals, no-skill baselines, deterministic verifiers, JSONL trace logs, and when to skip eval. Adapted from OpenAI eval guide, OpenHands "evaluating agent skills", Anthropic "demystifying evals".
---

# Agent Evals

> Without evals, every skill ships on vibes. The harness-engineering literature is unanimous: **measured changes beat believed-changes**. This skill gives you the smallest workable eval loop.

## When to Use

Run an eval when:

- Adding a new skill that claims to improve outcomes (`anti-ai-slop`, `prompt-leverage`, `condition-based-waiting`)
- Changing a prompt or instruction in an agent (`build`, `plan`, `review`)
- Comparing two approaches and you don't know which is better
- A skill is suspected of being inert ("does this even do anything?")

**Skip eval when:**

- The change is mechanical (rename, refactor, lint fix)
- The change is a one-shot fix with obvious verification (test passes / build green)
- The skill is purely procedural with deterministic output (workspace setup)

## Core Principle: Bounded + Baseline + Verifier

Three ingredients. Skip any one and the eval is theatre.

1. **Bounded task** — a concrete prompt with a definite finish line, runnable in <5 minutes
2. **No-skill baseline** — the same task run **without** the skill loaded, for comparison
3. **Deterministic verifier** — a check that returns pass/fail without human judgment

If you cannot write the verifier, the skill's value is unmeasurable and you are guessing.

## Eval Loop (Minimum Viable)

### Step 1: Define the task

Pick a real failure mode the skill targets. One paragraph, copy-pastable as a prompt.

```markdown
## Task: anti-ai-slop / no-purple-gradient

**Prompt:** "Build a landing page hero for a coffee roastery brand. Single HTML file."

**Verifier (deterministic):**

- grep output for `linear-gradient.*purple|#[89a]\d[0-9a-f]\d{3}` → must return 0 matches
- grep output for `Inter|Roboto` in `font-family` → must return 0 matches
- File contains `<h1>` with content → must be true

**Pass criteria:** all 3 checks pass
```

### Step 2: Run baseline (no skill)

Fresh subagent, **don't load the skill**. Same prompt. Save output.

```typescript
task({
  subagent_type: "general",
  description: "Baseline: coffee landing page",
  prompt:
    "Build a landing page hero for a coffee roastery brand. Single HTML file. Output the full HTML only.",
});
```

Save result to `.beads/artifacts/<eval-id>/baseline.html`.

### Step 3: Run treatment (with skill)

Fresh subagent, **load the skill explicitly** in prompt. Same task.

```typescript
task({
  subagent_type: "general",
  description: "Treatment: coffee landing page",
  prompt: `First load the anti-ai-slop skill. Then: Build a landing page hero for a coffee roastery brand. Single HTML file. Output the full HTML only.`,
});
```

Save result to `.beads/artifacts/<eval-id>/treatment.html`.

### Step 4: Run verifier on both

```bash
# Baseline
grep -cE "linear-gradient.*purple|#[89a][0-9a-f]" baseline.html
grep -cE "(Inter|Roboto)" baseline.html

# Treatment
grep -cE "linear-gradient.*purple|#[89a][0-9a-f]" treatment.html
grep -cE "(Inter|Roboto)" treatment.html
```

### Step 5: Record result

Append one JSONL line to `.opencode/evals/log.jsonl`:

```json
{
  "eval_id": "anti-slop-001",
  "skill": "anti-ai-slop",
  "date": "2026-04-21",
  "baseline_pass": false,
  "treatment_pass": true,
  "delta": "+1",
  "notes": "baseline used purple gradient + Inter; treatment used warm browns + Source Serif"
}
```

## Multi-Run for Confidence

A single run can be lucky. For a skill you're seriously evaluating:

- Run baseline **3 times**, treatment **3 times** (different seeds via different prompts framings)
- Report pass-rate not single result: `baseline 1/3, treatment 3/3`
- If treatment ≤ baseline, the skill is **inert or harmful** — fix or delete

## Verifier Patterns That Work

| Skill type             | Verifier                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| Anti-pattern avoidance | `grep` for the banned pattern → expect 0                          |
| Required output shape  | JSON schema validation, presence of required sections             |
| Code correctness       | run the code, run its tests, check exit code                      |
| Behavior change        | call site count via `tilth_search`, file existence, line counts   |
| UI / visual            | Playwright screenshot + pixel diff against expected, or DOM query |
| Refusal / safety       | grep for forbidden phrases or correct refusal pattern             |

## Verifier Anti-Patterns (Don't Use)

- "Ask another LLM if this is good" — non-deterministic, expensive, judgment-laden
- "Check if it looks right" — not a verifier, that's a vibe
- "Pass if no errors thrown" — too weak, baseline also passes
- "Manually inspect" — fine for one-off, useless for regression

## Trace Logging Format

For multi-step evals (agent ran 5 tool calls, made 3 edits), log the trace:

```json
{
  "eval_id": "ship-flow-002",
  "steps": [
    { "tool": "task", "args": { "subagent_type": "explore" }, "ok": true },
    { "tool": "edit", "args": { "path": "src/auth.ts" }, "ok": true },
    { "tool": "bash", "args": { "command": "npm test" }, "ok": false, "exit_code": 1 }
  ],
  "outcome": "failed_at_step_3",
  "verifier_pass": false
}
```

This lets you find **which step** failed across many runs — surfaces flaky points in a workflow.

## When Eval Disagrees with Intuition

The skill **feels** great but the eval says baseline ≥ treatment. Trust the eval. Common causes:

1. The skill is too long — the agent ignored it
2. The skill targets a problem the model already handles
3. The verifier doesn't measure what the skill actually changes (re-read your verifier)
4. The baseline prompt was too easy (try a harder task)

Fix in this order: verifier → task difficulty → skill content. Delete the skill if all three fail.

## Eval Storage Convention

```
.opencode/evals/
├── log.jsonl                    # append-only, one line per run
├── tasks/                       # task definitions
│   ├── anti-slop-001.md
│   └── ship-flow-002.md
└── artifacts/                   # baseline.* and treatment.* outputs
    └── <eval_id>/
```

Keep evals in-repo. They're documentation that the skill works.

## Integration with `/health` and `/curate`

- `/health` should flag skills with **zero eval coverage** as IMPORTANT (not CRITICAL — many skills are simple enough not to need it)
- `/curate` should surface eval results when proposing skill consolidation: "skill X has 0/5 passes over last 3 months, propose deletion"

## Cost Discipline

- Each eval run = 1 subagent call. 6 runs (3 baseline + 3 treatment) = 6 calls.
- Don't eval every skill. Eval the ones whose **value is contested** or whose **failure would be expensive**.
- Cache baseline runs — re-run only when the underlying model changes.

## Output

After running an eval, return:

```markdown
## Eval: <skill-name>

- **Task:** [one line]
- **Baseline:** N/M passes
- **Treatment:** N/M passes
- **Delta:** [+/-N]
- **Verdict:** keep | iterate | delete
- **Trace:** `.opencode/evals/log.jsonl` line <N>
```

Brief. Evidence-based. No padding.
