---
name: skill-installer
description: Use when the user asks to list, import, or install skills from OpenAI or another GitHub repository into OpenCode skill directories.
version: 1.0.0
tags: [workflow, automation, integration]
dependencies: []
---

# skill-installer

Import skills from GitHub into OpenCode-compatible skill directories.

## When to Use

- User asks to “install skill X” from `openai/skills` or another repo
- User wants to list available curated skills before choosing
- User wants to copy one or more external skills into local OpenCode setup

## When NOT to Use

- Skill already exists locally and only needs editing
- User asked for manual adaptation (copy + rewrite), not automated install

## Default Destination

- Global OpenCode skill directory: `~/.config/opencode/skill`
- Override destination with `--dest <path>`

## Scripts

- `scripts/list-skills.py`
  - Lists skills from a GitHub repo path and marks already-installed skills.
- `scripts/install-skill-from-github.py`
  - Installs one or many skill folders from GitHub into OpenCode skill directory.

## Quick Start

```bash
# List curated skills from openai/skills
python3 .opencode/skill/skill-installer/scripts/list-skills.py

# Install one curated skill into ~/.config/opencode/skill
python3 .opencode/skill/skill-installer/scripts/install-skill-from-github.py \
  --repo openai/skills \
  --path skills/.curated/screenshot

# Install into project-local skills directory
python3 .opencode/skill/skill-installer/scripts/install-skill-from-github.py \
  --repo openai/skills \
  --path skills/.curated/gh-fix-ci \
  --dest .opencode/skill
```

## Notes

- Supports direct GitHub URLs (`--url`) and `owner/repo` (`--repo`) mode.
- Uses authenticated API requests if `GITHUB_TOKEN` or `GH_TOKEN` is set.
- Fails fast if destination skill directory already exists.
