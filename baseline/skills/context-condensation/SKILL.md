---
name: context-condensation
description: Use when context is approaching budget limits and you need to compress, OR when handing off to another session. Provides the explicit keep/drop rubric for what survives compression — preserve goals, progress, critical files, failing tests; drop exploration noise and resolved threads. Pairs with `/dcp compress` and `/handoff`. Adapted from OpenHands context-condensation, Manus context engineering, HumanLayer backpressure.
---

# Context Condensation

> Compression is not deletion — it is **selection of what survives**. The wrong selection makes the agent restart from zero. This skill defines what to keep.

## When to Use

- Context >100k tokens and growing
- Phase boundary reached (research done, ready to implement)
- Handing off to a new session via `/handoff`
- A subagent returns large output you need to integrate
- After `/dcp compress` ran but you still feel context drift

## Core Principle: 4 Tiers of Survival

Every conversation chunk falls into one of four tiers. Compress accordingly.

| Tier | Content                                                  | Action                  |
| ---- | -------------------------------------------------------- | ----------------------- |
| 1    | Goal, constraints, user-stated requirements              | **Preserve verbatim**   |
| 2    | Critical state — failing tests, current bug, open files  | **Preserve as summary** |
| 3    | Decisions made, alternatives rejected, why               | **Preserve as 1-liner** |
| 4    | Exploration noise — failed greps, dead ends, raw outputs | **Drop entirely**       |

## Keep List (Always)

Compress around these — never drop:

- **The user's literal request.** Direct quote when short. Paraphrase only when long, and label as paraphrase.
- **Active failures.** Current error message, failing test name + reason, open bug. Tells the next agent what's broken.
- **Decisions + rationale.** "Chose JWT over sessions because [reason]." One line each. Future agents inherit the why.
- **File paths currently being edited.** Exact paths, not "the auth file".
- **Verification status.** Last typecheck/lint/test result with timestamp.
- **Open questions for the user.** Questions awaiting human input.
- **Constraints discovered mid-task.** "User can't add new deps", "DB is read-only in this env".

## Drop List (Aggressive)

Compress these to a single line or remove entirely:

- **Resolved exploration.** Found the file? Drop the 5 greps that led there.
- **Tool output noise.** Full directory listings, `ls` outputs, package install logs. Keep only the relevant filename.
- **Verbose reasoning.** Your own multi-paragraph thinking that ended in one decision. Keep the decision.
- **Acknowledgments.** "Got it", "I'll do that next" — pure social filler.
- **Failed attempts that taught nothing.** If a wrong approach added no information, drop it. Keep failures that revealed a constraint.
- **Sub-agent self-reports.** Keep the result + verification, drop the agent's narrative summary (Worker Distrust Protocol — don't trust the prose).
- **Old plans you've since revised.** Keep only the current plan.

## Failure Preservation Rule

> **Useful failures stay. Useless failures go.**

A failure is **useful** if it:

- Revealed a constraint ("can't use `mv` on this filesystem")
- Eliminated a hypothesis ("the bug is not in the parser")
- Showed a trap that another agent would re-fall into

A failure is **useless** if it:

- Was a typo / fat-finger fixed immediately
- Was a tool-call format error with no semantic content
- Was an obvious dead end no agent would repeat

**Manus rule** (from "Context Engineering for AI Agents: Lessons from Building Manus"): keep useful failures **in-context** as warnings. Don't compress to "encountered errors then succeeded" — that loses the warning.

## Condensation Triggers (Beyond Token Count)

Token count is one trigger. These are the others:

| Trigger                               | Action                                          |
| ------------------------------------- | ----------------------------------------------- |
| Phase boundary (research → implement) | Compress all of research phase to summary       |
| Subagent returns >2k tokens           | Compress immediately, keep result + evidence    |
| Same question asked twice in session  | Indicates context drift — compress aggressively |
| Plan revised                          | Drop old plan completely                        |
| Conversation feels "lost"             | Compress; restart from goal + current state     |

## The Handoff Variant

When compressing for `/handoff` (different session, different agent will pick up), be **even more selective**:

- Preserve everything in Keep List
- Add a **`## Next Step`** with the literal next action
- Add a **`## Don't Re-Discover`** with traps already mapped
- Drop everything else

Handoff format:

```markdown
## Goal

[user's literal request]

## Status

- Done: [list of completed items with file:line]
- In progress: [current task]
- Blocked: [what's blocking, what was tried]

## Critical State

- Open files: [paths]
- Last verification: [command + result + timestamp]
- Active failures: [error / failing test]

## Decisions Made

- [one-liner] → [one-line rationale]

## Don't Re-Discover

- [trap 1]: [why]
- [trap 2]: [why]

## Next Step

[literal next action — copy-pastable command or description]
```

## Anti-Patterns

- **"Let me summarize what we did so far..."** in every response — you're re-summarizing instead of compressing once at boundaries
- **Dropping the goal during compression** — the worst failure mode; the next agent has no anchor
- **Keeping all failures** — context fills with noise, real signals get buried
- **Lossy paraphrase of user request** — when in doubt, quote verbatim
- **Compressing during active edits** — wait for atomic step to finish

## Integration

- **Before `/dcp compress`:** Use this rubric to decide what your `summary` field should contain
- **In `/handoff`:** This skill defines the handoff format
- **After subagent return:** Apply Drop List to the agent's narrative, keep result + verification only
- **In long sessions:** Re-read your own context every ~30 messages and apply the rubric

## Output

When you condense, briefly state what survived and what dropped:

```
Compressed messages 12-34. Kept: goal, 3 decisions, current failure (auth.ts:42 null deref).
Dropped: 5 file searches, 2 abandoned approaches, dir listings.
```

This makes the compression auditable. The user (or next agent) can challenge what got cut.
