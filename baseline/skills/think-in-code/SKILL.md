---
name: think-in-code
description: Use when answering questions that require counting, filtering, parsing, joining, or summarizing data — write a small script that prints only the answer instead of reading large files into context. Saves 90%+ tokens vs raw reads. Adapted from context-mode (mksglu/context-mode).
version: 1.0.0
tags: [context, workflow]
dependencies: []
---

# Think in Code

Compute answers with a small script. Don't drag raw data through context.

## Core Principle

> The model's job is to think. The script's job is to count, parse, filter, join. Then `console.log` only the answer.

When you need a fact derived from data (logs, JSON, CSV, command output, file lists), the cheapest path is:

1. Write 5–30 lines of code that produces the answer
2. Run it
3. Read **only** the printed answer

Reading the raw data into context first is almost always wrong.

## When to Use

- Counting things in files / API output / logs ("how many failed runs in the last 100?")
- Filtering large lists ("which dependencies haven't been updated in 6 months?")
- Parsing structured output (`gh pr list --json`, `git log --pretty=...`, large JSON config)
- Joining data across sources ("which files in `git diff` also have failing tests?")
- Summarizing logs (top 10 error messages, error rate over time)
- Computing diffs/intersections between two lists

## When NOT to Use

- The data is already small (<50 lines and you need most of it)
- You need to **read** the content for understanding, not extract a fact (e.g. reviewing a PR)
- The script itself would be longer than just reading the slice you need
- A single `grep -c` or `wc -l` already answers it — just run that

## Quick Decision

| Situation                               | Approach                                        |
| --------------------------------------- | ----------------------------------------------- |
| "How many X in Y?"                      | Script → `console.log(count)`                   |
| "Which Z match condition?"              | Script → `console.log(matches.join('\n'))`      |
| "Top N by metric?"                      | Script → `console.log(top.map(...).join('\n'))` |
| "What does this code do?"               | Read the file                                   |
| "What's broken in this 30-line config?" | Read the file                                   |
| "Count errors in 2MB log"               | Script — never `cat` it                         |

## Patterns

### Node one-liner (preferred for JSON / npm / fs work)

```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const deps = Object.keys(data.packages || {}).filter(k => k.startsWith('node_modules/'));
console.log('Total deps:', deps.length);
console.log('Unique top-level:', new Set(deps.map(d => d.split('/')[1])).size);
"
```

### Python one-liner (preferred for CSV / data crunching)

```bash
python3 -c "
import csv, sys
with open('data.csv') as f:
    rows = list(csv.DictReader(f))
errors = [r for r in rows if r['status'] == 'error']
print(f'errors: {len(errors)} / {len(rows)}')
print(f'top hosts:', sorted({r[\"host\"] for r in errors})[:5])
"
```

### Bash (only when output is guaranteed small)

```bash
# OK — output is one number
git log --since='1 week ago' --oneline | wc -l

# OK — already filtered small
gh pr list --state open --json number,title --jq '.[] | select(.title | contains("fix")) | .number'

# NOT OK — dumps everything into context
cat huge-log.txt | grep ERROR
# Better:
grep -c ERROR huge-log.txt                    # if you only need the count
grep ERROR huge-log.txt | head -20            # if you need samples
```

### Save script to a file when it's reusable

```bash
cat > /tmp/count-deps.js <<'EOF'
const fs = require('fs');
const lock = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pkgs = Object.keys(lock.packages || {});
const stale = pkgs.filter(p => p.includes('node_modules/') && !p.includes('node_modules/.'));
console.log(JSON.stringify({ total: pkgs.length, packages: stale.length }, null, 2));
EOF
node /tmp/count-deps.js package-lock.json
```

## Anti-Patterns

| Anti-Pattern                                              | Why It's Wrong                               | Do Instead                                  |
| --------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `cat huge.json` then "let me parse this in my head"       | Pulls 100KB+ into context for one answer     | `node -e "..."` to compute and print answer |
| `gh pr list --json ...` printing all fields               | Dumps 50+ PRs of metadata you don't need     | `--jq` to filter to just the field you want |
| `find . -name '*.ts'` to count files                      | Lists every path                             | `find . -name '*.ts' \| wc -l`              |
| Reading 5 large logs to compare error rates               | 5x context bloat for one comparison          | Script that opens all 5 and prints summary  |
| `curl https://api/...` raw piped to read                  | Whole response body in context               | `curl ... \| jq '.field'` or save to file   |
| Asking the model to "estimate" instead of running a count | Hallucination risk; counts are deterministic | Run the script                              |

## Verification

Before considering an answer "done":

1. The script ran without error
2. The printed output is what you reasoned about (don't substitute memory for output)
3. If the question was "how many", the script printed a number — not raw rows you then counted manually

## Why This Skill Exists

Adapted from the **Think in Code** pillar of [context-mode](https://github.com/mksglu/context-mode). The original ships a sandboxed executor that _forces_ this pattern; we keep the discipline as a prompt-level skill so it works without bundling new infrastructure.

The savings compound: a single avoided 100KB read pays for many script iterations, and downstream summarization/handoff becomes cheaper too.

## References

- context-mode: https://github.com/mksglu/context-mode
- Pairs with: `verification-before-completion`, `code-search-patterns`, `rtk-command-compression`
