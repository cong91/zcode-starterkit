---
description: Enforce zcode-starterkit architecture invariants (file sizes, naming, TODO hygiene). Ported from opencode-starterkit baseline/tool/structural-check.sh, adapted to the ZCode plugin layout.
---

# /structural-check

Run this command to verify zcode-starterkit baseline invariants. It checks the **zcode-starterkit structure** (not OpenCode's `.zcode/plugin` layout, which does not exist here).

## What it checks

1. **Agent file size** — `baseline/agents/*.md` ≤ 200 lines (agents are lean role definitions).
2. **Command file size** — `baseline/commands/*.md` ≤ 500 lines.
3. **Skill SKILL.md size** — `baseline/skills/*/SKILL.md` ≤ 600 lines.
4. **MCP tool source size** — `baseline/mcp-tools/src/**/*.ts` ≤ 400 lines per file.
5. **TODO/FIXME hygiene** — no bare `TODO`/`FIXME` without `@owner:` in `baseline/mcp-tools/src/`.
6. **Filename convention** — `baseline/agents`, `baseline/commands`, `baseline/mcp-tools/src` use kebab-case / lowercase filenames (no uppercase in basenames).

## How to run

Use the bash tool to execute this script inline (adapt paths to the repo root):

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ERRORS=0
fail() { echo "  FAIL: $1"; ERRORS=$((ERRORS+1)); }
pass() { echo "  PASS: $1"; }

check_size() {
  local p="$1" max="$2" label="$3"
  [ -f "$p" ] || return 0
  local lines; lines=$(wc -l <"$p")
  [ "$lines" -gt "$max" ] && fail "$label exceeds ${max} lines ($lines)"
}

echo "[1/6] Agent file sizes (<=200)..."
for f in "$ROOT/baseline/agents"/*.md; do check_size "$f" 200 "Agent $(basename "$f")"; done
pass "agents checked"

echo "[2/6] Command file sizes (<=500)..."
for f in "$ROOT/baseline/commands"/*.md; do check_size "$f" 500 "Command $(basename "$f")"; done
pass "commands checked"

echo "[3/6] Skill SKILL.md sizes (<=600)..."
while IFS= read -r -d '' f; do check_size "$f" 600 "Skill $(basename "$(dirname "$f")")/SKILL.md"; done < <(find "$ROOT/baseline/skills" -name SKILL.md -type f -print0 2>/dev/null)
pass "skills checked"

echo "[4/6] MCP tool source sizes (<=400)..."
while IFS= read -r -d '' f; do check_size "$f" 400 "MCP $(basename "$f")"; done < <(find "$ROOT/baseline/mcp-tools/src" -name "*.ts" -type f -print0 2>/dev/null)
pass "mcp sources checked"

echo "[5/6] TODO/FIXME hygiene..."
BAD_TODO=$(grep -rn "TODO\|FIXME" "$ROOT/baseline/mcp-tools/src/"*.ts 2>/dev/null | grep -v "@owner:" || true)
[ -n "$BAD_TODO" ] && { fail "TODOs/FIXMEs without @owner in mcp-tools/src:"; echo "$BAD_TODO" | head -5; }
pass "TODO hygiene acceptable"

echo "[6/6] Filename convention (lowercase/kebab-case)..."
BAD_NAMES=$(find "$ROOT/baseline/agents" "$ROOT/baseline/commands" "$ROOT/baseline/mcp-tools/src" -type f \( -name "*.md" -o -name "*.ts" \) 2>/dev/null | while IFS= read -r f; do bn=$(basename "$f"); echo "$bn" | grep -q "[A-Z]" && echo "$f"; done || true)
[ -n "$BAD_NAMES" ] && { fail "Files with uppercase in name (use kebab-case):"; echo "$BAD_NAMES"; }
pass "Filename convention OK"

echo "---"
if [ "$ERRORS" -eq 0 ]; then echo "[OK] All structural checks passed."; else echo "[FAIL] $ERRORS check(s) failed. Fix issues above."; fi
exit $ERRORS
```

## Remediation

- File too long → split into smaller modules.
- TODOs without owner → add `// @owner:name`.
- Uppercase filenames → rename to kebab-case.
