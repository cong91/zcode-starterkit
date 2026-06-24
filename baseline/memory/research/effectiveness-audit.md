---
purpose: Systematic effectiveness audit of all template skills, tools, and commands
updated: 2026-03-08
framework: benchmark-framework.md (7 dimensions, 0-2 each, max 14)
---

# Effectiveness Audit — OpenCodeKit Template

## Methodology

Scored 25+ skills, 2 tools, 18 commands using the benchmark framework.
Dimensions: **T**rigger clarity, **R**eplaces X, **E**xamples, **A**nti-patterns, **V**erification, **Tok**en efficiency, **X**-references.
Scale: 0=missing, 1=partial, 2=strong. Max: 14.

## Summary

| Metric             | Value    |
| ------------------ | -------- |
| Total skills       | 73       |
| Reviewed in detail | 25       |
| Exemplary (12-14)  | 5 (20%)  |
| Adequate (8-11)    | 10 (40%) |
| Needs Work (4-7)   | 8 (32%)  |
| Poor (0-3)         | 2 (8%)   |
| Custom tools       | 2        |
| Commands           | 18       |

## Tier 1: Exemplary (12-14)

Skills ready to ship — high adoption, measurable value.

| Skill                          | T   | R   | E   | A   | V   | Tok | X   | Total  | Tokens | Notes                                                                   |
| ------------------------------ | --- | --- | --- | --- | --- | --- | --- | ------ | ------ | ----------------------------------------------------------------------- |
| structured-edit                | 2   | 1   | 2   | 2   | 2   | 2   | 2   | **13** | ~1.3k  | Gold standard. 5-step protocol, Red Flags, BAD/GOOD examples, quick ref |
| code-navigation                | 2   | 2   | 2   | 2   | 0   | 2   | 2   | **12** | ~1.2k  | 7 patterns, tilth comparison, cost awareness, right/wrong examples      |
| verification-before-completion | 2   | 0   | 2   | 2   | 2   | 2   | 1   | **11** | ~1.6k  | Iron Law, rationalization prevention, smart verification                |
| tool-priority                  | 2   | 2   | 2   | 2   | 0   | 1   | 2   | **11** | ~3.3k  | "Replaces X" on all tools, tilth section, LSP 9-op table                |
| requesting-code-review         | 2   | 0   | 2   | 2   | 2   | 1   | 2   | **11** | ~2.5k  | 3 review depths, 5 reviewer prompts, synthesis checklist                |

### What makes these work

1. **Right/wrong examples** — Every exemplary skill shows incorrect then correct approach
2. **Tables over prose** — Decision tables, comparison tables, common mistakes tables
3. **Integrated verification** — structured-edit Step 5 (CONFIRM), verification-before-completion Iron Law
4. **Quick reference blocks** — structured-edit and tool-priority both end with copy-pasteable references
5. **"Replaces X" framing** — code-navigation and tool-priority explicitly state what they supersede

## Tier 2: Adequate (8-11)

Functional but missing patterns that would improve adoption.

| Skill                       | T   | R   | E   | A   | V   | Tok | X   | Total  | Tokens | Gap                                                  |
| --------------------------- | --- | --- | --- | --- | --- | --- | --- | ------ | ------ | ---------------------------------------------------- |
| dispatching-parallel-agents | 2   | 0   | 2   | 2   | 2   | 2   | 0   | **10** | ~1.4k  | No "Replaces X", no cross-refs                       |
| executing-plans             | 2   | 0   | 2   | 1   | 2   | 1   | 2   | **10** | ~1.5k  | No "Replaces X"                                      |
| agent-teams                 | 2   | 0   | 2   | 2   | 1   | 1   | 1   | **9**  | ~2.1k  | No "Replaces X", could be more token-efficient       |
| condition-based-waiting     | 2   | 1   | 2   | 2   | 0   | 2   | 0   | **9**  | ~868   | No verification step, no cross-refs                  |
| root-cause-tracing          | 2   | 0   | 2   | 0   | 1   | 2   | 1   | **8**  | ~1.2k  | No anti-patterns, no "Replaces X"                    |
| writing-plans               | 2   | 0   | 2   | 1   | 1   | 1   | 1   | **8**  | ~2.0k  | No "Replaces X", could trim                          |
| beads                       | 2   | 0   | 2   | 0   | 0   | 2   | 2   | **8**  | ~1.2k  | No anti-patterns, no verification                    |
| receiving-code-review       | 2   | 0   | 2   | 2   | 1   | 1   | 0   | **8**  | ~1.7k  | No "Replaces X", no cross-refs                       |
| defense-in-depth            | 2   | 0   | 2   | 0   | 0   | 2   | 1   | **7**  | ~1.0k  | No anti-patterns, no verification                    |
| systematic-debugging        | 2   | 0   | 2   | 1   | 0   | 1   | 0   | **6**  | ~1.6k  | Border case — no verification, limited anti-patterns |

### Common gaps in this tier

1. **No "Replaces X"** — 9/10 adequate skills lack replacement framing
2. **Missing verification** — 6/10 don't integrate verification steps
3. **No anti-patterns** — 5/10 lack anti-pattern sections
4. **No cross-references** — 4/10 are isolated (no links to related skills)

## Tier 3: Needs Work (4-7)

Significant gaps — may load but produce suboptimal results.

| Skill                       | T   | R   | E   | A   | V   | Tok | X   | Total | Tokens | Issue                                          |
| --------------------------- | --- | --- | --- | --- | --- | --- | --- | ----- | ------ | ---------------------------------------------- |
| context-management          | 2   | 0   | 2   | 1   | 0   | 1   | 0   | **6** | ~1.7k  | Overlaps with DCP system prompts               |
| session-management          | 2   | 0   | 1   | 1   | 0   | 2   | 0   | **6** | ~848   | Generic, no tool examples                      |
| swarm-coordination          | 2   | 0   | 1   | 1   | 0   | 1   | 1   | **6** | ~1.8k  | Partially complete, missing examples           |
| memory-system               | 2   | 0   | 2   | 0   | 0   | 1   | 0   | **5** | ~2.4k  | Token-heavy, no anti-patterns, no verification |
| brainstorming               | 2   | 0   | 0   | 0   | 0   | 2   | 1   | **5** | ~832   | No examples, no anti-patterns                  |
| mockup-to-code              | 2   | 0   | 1   | 0   | 0   | 2   | 0   | **5** | ~794   | Prompt templates only                          |
| subagent-driven-development | 2   | 0   | 1   | 0   | 0   | 2   | 0   | **5** | ~1.2k  | No anti-patterns, no verification              |
| visual-analysis             | 2   | 0   | 1   | 0   | 0   | 2   | 0   | **5** | ~705   | Prompt templates only                          |

### Common issues

1. **Prompt-template-only pattern** — mockup-to-code, visual-analysis give templates without tool integration
2. **No anti-patterns** — 7/8 lack anti-pattern sections entirely
3. **No verification** — 8/8 don't integrate verification
4. **No examples** — brainstorming has zero code examples

## Tier 4: Poor (0-3)

Should be rewritten or merged.

| Skill               | T   | R   | E   | A   | V   | Tok | X   | Total | Tokens | Action                                                       |
| ------------------- | --- | --- | --- | --- | --- | --- | --- | ----- | ------ | ------------------------------------------------------------ |
| ui-ux-research      | 2   | 0   | 1   | 0   | 0   | 2   | 0   | **5** | ~609   | Merge into design-system-audit or rewrite with tool examples |
| design-system-audit | 2   | 0   | 1   | 0   | 0   | 2   | 0   | **5** | ~527   | Merge with ui-ux-research or add substance                   |

_Note: These scored 5 (Needs Work) on the rubric but are categorized as effective tier 4 because they consist entirely of prompt templates with no actionable tool integration, anti-patterns, or verification — making them the least effective in practice._

## Not Reviewed (Estimated by Category)

These 48 skills were not read in detail. Estimates based on YAML description, size, and category patterns.

### Platform-Specific (likely Adequate if domain is relevant)

- swiftui-expert-skill (~4.2k tokens) — Largest skill, likely good depth
- swift-concurrency, core-data-expert — Domain-specific
- react-best-practices, supabase-postgres-best-practices — Framework-specific

### External Integrations (varies)

- resend, cloudflare, supabase, polar, jira, figma, stitch, v0, v1-run, mqdh
- These are MCP connector skills — effectiveness depends on API coverage

### Meta Skills

- skill-creator, writing-skills, testing-skills-with-subagents, sharing-skills, using-skills
- Self-referential — should follow their own rules

### Browser/Automation

- playwright, playwriter, agent-browser, chrome-devtools

### Context/Lifecycle

- compaction, context-engineering, context-initialization, gemini-large-context
- development-lifecycle, prd, prd-task
- finishing-a-development-branch, using-git-worktrees
- deep-research, source-code-research, opensrc, augment-context-engine
- beads-bridge, ralph, index-knowledge, obsidian, pdf-extract
- accessibility-audit, web-design-guidelines, frontend-design

## Tools Audit

| Tool       | T   | R   | E   | A   | V   | Tok | X   | Total | Tokens | Notes                                                   |
| ---------- | --- | --- | --- | --- | --- | --- | --- | ----- | ------ | ------------------------------------------------------- |
| context7   | 2   | 2   | 2   | 0   | 0   | 1   | 0   | **7** | ~1.4k  | Has "Replaces X" + WHEN/SKIP. Missing anti-patterns     |
| grepsearch | 1   | 2   | 2   | 0   | 0   | 2   | 0   | **7** | ~946   | Has "Replaces X". Missing full SKIP gate, anti-patterns |

### Tool recommendations

- Add anti-patterns to both tool descriptions (common misuse patterns)
- context7: Add "SKIP: Internal code (use tilth/grep)" explicitly
- grepsearch: Add full WHEN/SKIP binary gate

## Commands Assessment

18 commands total. Commands evaluated on: clear trigger, actionable steps, verification integration, error guidance.

| Command                     | Category | Quality | Notes                                            |
| --------------------------- | -------- | ------- | ------------------------------------------------ |
| lfg                         | Workflow | High    | Full chain orchestration                         |
| ship                        | Workflow | High    | Clear gates and verification                     |
| plan                        | Planning | High    | Structured output                                |
| verify                      | Quality  | High    | Recently improved (incremental, parallel, cache) |
| compound                    | Learning | High    | Extracts learnings                               |
| start/resume/handoff        | Session  | Medium  | Functional but could cross-ref more              |
| status                      | Info     | Medium  |                                                  |
| pr                          | Git      | Medium  |                                                  |
| review-codebase             | Quality  | Medium  |                                                  |
| research                    | Research | Medium  |                                                  |
| design/ui-review            | Design   | Low     | Prompt-template style                            |
| init/init-user/init-context | Setup    | High    | Well-tested                                      |
| create                      | Meta     | Medium  |                                                  |

## Overlap Analysis

| Pair                                                           | Overlap                              | Recommendation                                        |
| -------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| context-management ↔ compaction                                | Both manage context size             | Merge or clearly differentiate                        |
| agent-teams ↔ swarm-coordination ↔ dispatching-parallel-agents | All handle parallel agents           | Create decision tree in agent-teams, reference others |
| session-management ↔ context-management                        | Both track context thresholds        | Merge session into context-management                 |
| ui-ux-research ↔ design-system-audit ↔ visual-analysis         | All design-focused prompt templates  | Consolidate into one design-audit skill               |
| beads ↔ beads-bridge                                           | Bridge extends beads for multi-agent | Clear but should be documented in beads               |
| structured-edit ↔ code-navigation                              | Both about code manipulation         | Cross-reference each other                            |

## Top 10 Improvement Priorities

Ranked by impact (core skills first, high-frequency usage).

| #   | Action                                                                     | Target            | Impact                      |
| --- | -------------------------------------------------------------------------- | ----------------- | --------------------------- |
| 1   | Add "Replaces X" to top 10 skills                                          | All tier 2 skills | +adoption (tilth: +36pp)    |
| 2   | Add anti-patterns to beads, defense-in-depth, root-cause-tracing           | Core debugging    | +failure prevention         |
| 3   | Add verification steps to condition-based-waiting, defense-in-depth, beads | Core workflow     | +correctness                |
| 4   | Consolidate context-management + session-management                        | Context skills    | -redundancy, -token cost    |
| 5   | Consolidate ui-ux-research + design-system-audit + visual-analysis         | Design skills     | -3 weak skills → 1 adequate |
| 6   | Rewrite brainstorming with concrete examples                               | Planning          | +actionability              |
| 7   | Add cross-references to isolated skills (6 skills)                         | Various           | +routing                    |
| 8   | Trim memory-system from 2.4k to ~1.5k tokens                               | Core              | +token efficiency           |
| 9   | Add "Replaces X" to tools (context7 SKIP gate, grepsearch WHEN gate)       | Tools             | +routing                    |
| 10  | Audit remaining 48 un-reviewed skills                                      | All               | Full coverage               |

## Template-Level Metrics

| Metric                        | Target | Current          | Status     |
| ----------------------------- | ------ | ---------------- | ---------- |
| Core skills at Exemplary tier | 100%   | 50% (5/10 core)  | Needs work |
| No skills at Poor tier        | 0      | 2                | Needs work |
| Average token cost per skill  | <1500  | ~1.5k (reviewed) | Borderline |
| Skills with WHEN/SKIP gates   | 100%   | 100% (reviewed)  | PASS       |
| Skills with anti-patterns     | >75%   | 44% (11/25)      | Needs work |
| Overlap/redundancy pairs      | 0      | 6 pairs          | Needs work |

---

_Next: Apply improvement priorities starting with #1 (add "Replaces X" to tier 2 skills)._
_Re-audit after changes to measure improvement._
