---
name: screenshot
description: Use when the user explicitly asks for desktop/system screenshots or when browser/tool-specific capture is unavailable.
version: 1.0.0
tags: [debugging, ui, automation]
dependencies: []
---

# screenshot

Capture screenshots at OS level for desktop apps, windows, regions, or full screen.

## When to Use

- User asks for screenshot of desktop/app/window/region
- You need non-browser captures (native app, OS UI, Electron shell)
- Browser capture tools are unavailable or insufficient

## When NOT to Use

- Browser-only capture where Playwright/DevTools is enough
- Design-file capture where Figma skills are available

## Save Location Rules

1. If user gives a path, save there.
2. If user asks generally for a screenshot, use OS default screenshot location.
3. If screenshot is for agent inspection, save to temp location.

## Scripts

- `scripts/take_screenshot.py` (macOS/Linux)
- `scripts/take_screenshot.ps1` (Windows)
- `scripts/ensure_macos_permissions.sh` (macOS preflight)

## Quick Start

```bash
# macOS/Linux default capture
python3 .zcode/skill/screenshot/scripts/take_screenshot.py

# capture app window(s) on macOS to temp
bash .zcode/skill/screenshot/scripts/ensure_macos_permissions.sh && \
python3 .zcode/skill/screenshot/scripts/take_screenshot.py --app "Codex" --mode temp

# region capture
python3 .zcode/skill/screenshot/scripts/take_screenshot.py --mode temp --region 100,200,800,600
```
