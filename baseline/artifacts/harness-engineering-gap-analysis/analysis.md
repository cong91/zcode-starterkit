# Harness Engineering Gap Analysis

**Date:** 2026-06-08
**Sources:** [OpenAI Harness Engineering](https://openai.com/index/harness-engineering/), [Ryan Lopopolo talk](https://www.youtube.com/watch?v=am_oeAoUhew)

---

## Current OpenCodeKit Harness Inventory

### Guides (Feedforward — steer before action)
| Component | Type | Status |
|---|---|---|
| AGENTS.md (292 lines) | Inferential guide | [x] Exists — too long (needs ~100 lines) |
| 60 skills (tiered) | Inferential + Computational | [x] Strong |
| Permission system (opencode.json) | Computational | [x] Unique advantage |
| Behavioral kernel | Inferential | [x] Strong |
| Constitutional compliance gate | Computational | [x] Strong |
| Plan quality gate | Computational | [x] Strong |
| Prompt leverage plugin | Inferential | [x] Unique advantage |
| Custom linters with remediation | Computational | [ ] Missing |
| Structural tests (dependency rules) | Computational | [ ] Missing |
| Architecture enforcement | Computational | [ ] Missing |
| Taste invariants | Computational | [ ] Missing |
| Ratchet principle | Inferential | [ ] Missing |

### Sensors (Feedback — validate after action)
| Component | Type | Status |
|---|---|---|
| TypeCheck | Computational | [x] On par |
| Lint (oxlint) | Computational | [x] On par |
| Tests | Computational | [x] On par |
| Verification protocol | Both | [x] Strong |
| Agent-to-agent review (5 parallel) | Inferential | [x] Already doing this |
| Iterative quality loop (score-gated) | Both | [x] Ahead of OpenAI |
| Fallow dead code/duplication | Computational | [x] Equivalent to GC |
| Goal-backward verification (3-level) | Computational | [x] Already doing this |
| UI slop check | Computational | [x] Different approach, valid |
| Observability for agents | Computational | [ ] Not wired |
| Chrome DevTools for agents | Both | [ ] Not wired |

### Architecture Enforcement
| Pattern | Status |
|---|---|
| Layered architecture with strict edges | [ ] Not defined |
| Custom linters enforcing boundaries | [ ] Not present |
| Package privacy / dependency edges | [ ] Not present |

### Environment Design
| Pattern | Status |
|---|---|
| Fix harness, not output (ratchet) | [ ] Not explicit in AGENTS.md |
| "What capability is missing?" | [x] Present in kernel |
| Per-worktree isolation | [!]️ Skill exists, not auto-wired |

### Garbage Collection
| Pattern | Status |
|---|---|
| Recurring cleanup agents | [ ] Not automated |
| Quality grades per domain | [ ] Not present |
| Automated refactoring PRs | [ ] Not present |

---

## Top 9 Recommendations (Priority Order)

### 1. Sharpen AGENTS.md to ~100 lines (HIGH / LOW EFFORT)
Split into: AGENTS.md (map) + context/operating-principles.md + context/verification-protocol.md + context/delegation-policy.md

### 2. Add Ratchet Principle to behavioral kernel (HIGH / LOW EFFORT)
"The harness only tightens, never loosens."

### 3. Add remediation to lint messages (HIGH / LOW EFFORT)
Instruct agents from lint errors — positive prompt injection.

### 4. Define & enforce layered architecture (HIGH / MEDIUM EFFORT)
Natural layers: Instructions → Skills → Commands → Plugins → Tools

### 5. Create garbage collection workflow (HIGH / MEDIUM EFFORT)
Fallow + review agent + cleanup PRs. Manual invocation via `/gc`.

### 6. Add taste invariants (MEDIUM / LOW EFFORT)
File size limits, naming conventions, no monolithic files.

### 7. Wire CDP for agent-legible UI (MEDIUM / LOW EFFORT)
Browser automation for agent self-verification of UI changes.

### 8. Track quality grades per domain (LOW / OPTIONAL)
QUALITY.md tracking architectural layer health.

### 9. Agent-accessible observability (LOW / OPTIONAL)
Future: LogQL/PromQL for agents when runtime services exist.
