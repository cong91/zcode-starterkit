# Project Context

Files in this directory are automatically injected into all AI prompts via the `instructions` array in `opencode.json`.

## Purpose

Put project-specific context here that you want the AI to always know about:
- Architecture decisions
- Business domain knowledge  
- API conventions
- Team agreements
- Anything the AI needs as background context

## How it works

1. Add `.md` files to this directory
2. Add the file path to `opencode.json` → `instructions[]`:
   ```json
   "instructions": [
     ".opencode/context/your-file.md"
   ]
   ```
3. The file content will be injected into every AI prompt

## Important

- This directory is **preserved** during `init --force` and `upgrade`
- Keep files concise — every token counts in the AI context window
- Use markdown format for best results
