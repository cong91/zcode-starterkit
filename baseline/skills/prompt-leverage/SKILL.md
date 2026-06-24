---
name: prompt-leverage
description: >-
  Strengthen raw user prompts into execution-ready instruction sets. Use when processing
  user input to upgrade it with clear objective, context, work style, tool rules, output
  contract, verification, and done criteria before planning or execution.
metadata:
  dependencies: []
---

# Prompt Leverage

Strengthen the user's current prompt into a stronger working instruction set without changing the underlying intent. Preserve the task, fill in missing execution structure, and add only enough scaffolding to improve reliability.

This skill acts as a **pre-processing layer** — it runs on user input BEFORE planning/execution to ensure every prompt is execution-ready.

## Workflow

1. Read the raw prompt and identify the real job to be done.
2. Infer the task type: coding, research, writing, analysis, planning, or review.
3. Rebuild the prompt with the framework blocks in `references/framework.md`.
4. Keep the result proportional: do not over-specify a simple task.
5. Return both the improved prompt and a short explanation of what changed when useful.

## Transformation Rules

- Preserve the user's objective, constraints, and tone unless they conflict.
- Prefer adding missing structure over rewriting everything stylistically.
- Add context requirements only when they improve correctness.
- Add tool rules only when tool use materially affects correctness.
- Add verification and completion criteria for non-trivial tasks.
- Keep prompts compact enough to be practical in repeated use.

## Framework Blocks

Use these blocks selectively.

- `Objective`: state the task and what success looks like.
- `Context`: list sources, files, constraints, and unknowns.
- `Work Style`: set depth, breadth, care, and first-principles expectations.
- `Tool Rules`: state when tools, browsing, or file inspection are required.
- `Output Contract`: define structure, formatting, and level of detail.
- `Verification`: require checks for correctness, edge cases, and better alternatives.
- `Done Criteria`: define when the agent should stop.

## Output Modes

Choose one mode based on the user request.

- `Inline upgrade`: provide the upgraded prompt only.
- `Upgrade + rationale`: provide the prompt plus a brief list of improvements.
- `Template extraction`: convert the prompt into a reusable fill-in-the-blank template.
- `Hook spec`: explain how to apply the framework automatically before execution.

## Quality Bar

Before finalizing, check the upgraded prompt:

- still matches the original intent
- does not add unnecessary ceremony
- includes the right verification level for the task
- gives the agent a clear definition of done

If the prompt is already strong, say so and make only minimal edits.

## Intensity Levels

Use the minimum level that matches the task.

- `Light`: simple edits, formatting, quick rewrites.
- `Standard`: typical coding, research, and drafting tasks.
- `Deep`: debugging, architecture, complex research, or high-stakes outputs.

## Task-Type Adjustments

### Coding

- Emphasize repo context, file inspection, smallest correct change, validation, and edge cases.

### Research

- Emphasize source quality, evidence gathering, synthesis, uncertainty, and citations.

### Writing

- Emphasize audience, tone, structure, constraints, and revision criteria.

### Review

- Emphasize fresh-eyes critique, failure modes, alternatives, and explicit severity.
