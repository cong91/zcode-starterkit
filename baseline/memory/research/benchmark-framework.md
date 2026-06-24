---
purpose: Scoring rubric for evaluating template agent effectiveness
updated: 2026-03-08
based-on: tilth research (measurable pattern adoption improvements)
---

# Agent Effectiveness Benchmark Framework

## Purpose

Evaluate whether skills, tools, and commands in the OpenCodeKit template actually help AI agents perform better. Based on tilth's methodology: they measured accuracy, cost/correct answer, and tool adoption rates to prove what works.

## Scoring Dimensions

7 dimensions, each scored 0–2. Max score: **14**.

### 1. Trigger Clarity (WHEN/SKIP)

Does the description clearly specify when to load AND when NOT to?

| Score | Criteria                                    |
| ----- | ------------------------------------------- |
| 0     | Vague or missing trigger conditions         |
| 1     | Has WHEN but not WHEN NOT (or vice versa)   |
| 2     | Clear WHEN and WHEN NOT (SKIP) binary gates |

**Why it matters:** tilth found explicit WHEN/SKIP gates are the single most effective pattern for correct tool routing. Without them, agents either over-load (waste tokens) or under-load (miss relevant skills).

### 2. "Replaces X" Framing

Does it explicitly state what behavior, tool, or workflow it replaces?

| Score | Criteria                                       |
| ----- | ---------------------------------------------- |
| 0     | No replacement framing                         |
| 1     | Implied replacement or "better than X"         |
| 2     | Explicit "Replaces X" statement in description |

**Why it matters:** tilth measured +36 percentage points adoption on Haiku when tool descriptions included "Replaces X" framing. Models route better when they know what's superseded.

### 3. Concrete Examples

Does it provide working code with actual tool calls, not just prose?

| Score | Criteria                                                                |
| ----- | ----------------------------------------------------------------------- |
| 0     | No examples                                                             |
| 1     | Prose descriptions or generic prompt templates                          |
| 2     | Working code examples with actual tool calls / before-after comparisons |

**Why it matters:** Models follow examples more reliably than instructions. Prompt templates ("Analyze this image: [attach]") score 1, not 2 — they lack tool integration.

### 4. Anti-Patterns

Does it show what NOT to do?

| Score | Criteria                                                       |
| ----- | -------------------------------------------------------------- |
| 0     | No anti-patterns section                                       |
| 1     | Brief "don't do X" mentions                                    |
| 2     | Wrong/right comparison table or detailed anti-patterns section |

**Why it matters:** Failure prevention is as valuable as success instruction. tilth's evidence-based feature removal (disabling `--map` because 62% of losing tasks used it) proves tracking what fails matters.

### 5. Verification Integration

Does it reference or require verification steps?

| Score | Criteria                                                       |
| ----- | -------------------------------------------------------------- |
| 0     | No mention of verification                                     |
| 1     | Mentions verification in passing                               |
| 2     | Integrates verification steps into workflow (run X, confirm Y) |

**Why it matters:** Skills that don't include verification produce unverified outputs. The build loop is perceive → create → **verify** → ship.

### 6. Token Efficiency

Is the token cost proportional to value delivered?

| Score | Criteria                                                                       |
| ----- | ------------------------------------------------------------------------------ |
| 0     | >2500 tokens with low value density (filler, repetition, obvious instructions) |
| 1     | Reasonable size OR moderate value density                                      |
| 2     | <1500 tokens with high value density, OR larger with proportional density      |

**Why it matters:** Every loaded skill consumes context budget. A 4000-token skill that could be 1500 tokens is actively harmful — it displaces working memory.

### 7. Cross-References

Does it link to related skills for next steps?

| Score | Criteria                                                                     |
| ----- | ---------------------------------------------------------------------------- |
| 0     | No references to other skills                                                |
| 1     | Mentions related skills in text                                              |
| 2     | Clear "Related Skills" table or "Next Phase" with skill loading instructions |

**Why it matters:** Skills that exist in isolation force agents to discover connections. Explicit connections reduce routing failures.

## Score Interpretation

| Range | Tier       | Meaning                                                     |
| ----- | ---------- | ----------------------------------------------------------- |
| 12–14 | Exemplary  | Ready to ship — high adoption, measurable value             |
| 8–11  | Adequate   | Functional but missing patterns that would improve adoption |
| 4–7   | Needs Work | Significant gaps — may load but produce suboptimal results  |
| 0–3   | Poor       | Should be rewritten or merged into another skill            |

## Category Assessment

Beyond individual scoring, evaluate each skill's **category fit**:

| Category             | Expected Traits                                                                  |
| -------------------- | -------------------------------------------------------------------------------- |
| Core Workflow        | Loaded frequently, high token ROI, tight integration with other core skills      |
| Planning & Lifecycle | Clear phase transitions, handoff points between skills                           |
| Debugging & Quality  | Real examples from actual debugging sessions, measurable impact                  |
| Code Review          | Severity levels, actionable findings format                                      |
| Design & UI          | Visual reference integration, component breakdown                                |
| Agent Orchestration  | Parallelism rules, coordination protocols                                        |
| External Integration | API examples, auth handling, error patterns                                      |
| Platform Specific    | Version-pinned APIs, migration guidance                                          |
| Meta Skills          | Self-referential consistency (does the skill-about-skills follow its own rules?) |

## Audit Process

1. **Inventory** — List all skills with token size
2. **Sample** — Read representative skills from each category
3. **Score** — Apply 7 dimensions to each sampled skill
4. **Classify** — Assign tier and category
5. **Identify** — Flag overlaps, dead weight, and upgrade candidates
6. **Prioritize** — Rank improvements by impact (core skills first)

## Effectiveness Signals (Observable)

Beyond the rubric, track these runtime signals when possible:

| Signal                                     | Indicates                                                    |
| ------------------------------------------ | ------------------------------------------------------------ |
| Skill loaded but instructions not followed | Trigger too broad OR instructions too vague                  |
| Skill never loaded despite relevant tasks  | Trigger too narrow OR description doesn't match task framing |
| Agent re-reads files after skill search    | Skill examples insufficient — agent needs more context       |
| Verification skipped after skill workflow  | Skill doesn't integrate verification                         |
| Agent loads 5+ skills simultaneously       | Skills too granular — should be merged                       |

## Template-Level Metrics

For the overall template (all skills + tools + commands):

| Metric                        | Target | Current |
| ----------------------------- | ------ | ------- |
| Core skills at Exemplary tier | 100%   | (audit) |
| No skills at Poor tier        | 0      | (audit) |
| Average token cost per skill  | <1500  | (audit) |
| Skills with WHEN/SKIP gates   | 100%   | (audit) |
| Skills with anti-patterns     | >75%   | (audit) |
| Overlap/redundancy pairs      | 0      | (audit) |

---

_Apply this framework during effectiveness audits. Update scoring criteria as new evidence emerges._
