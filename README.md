# zcode-starterkit

Bootstrap package for the **ZCode Agent**. Installs a shared baseline (skills, commands, agents, config) as ZCode plugins globally, then creates a thin per-project `.zcode/` overlay.

## Install (global baseline)

```bash
npx zcode-starterkit
```

## Sandbox test (does not touch real ~/.zcode)

```bash
zcode-starterkit --sandbox
```

## Project overlay

```bash
zcs install
```

See `docs/superpowers/specs/2026-06-24-zcode-starterkit-design.md` for the full design.
