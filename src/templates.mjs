import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { PROJECT_MEMORY_FILES } from './constants.mjs'

function toTitleCase(value) {
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (m) => m.toUpperCase())
}

function detectPackageManager(cwd) {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) return 'bun'
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) return 'npm'
  return null
}

function detectGitRemote(cwd) {
  const result = spawnSync('git', ['config', '--get', 'remote.origin.url'], { cwd, encoding: 'utf8' })
  if (result.status !== 0) return null
  return String(result.stdout || '').trim() || null
}

function detectCurrentBranch(cwd) {
  const result = spawnSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' })
  if (result.status !== 0) return null
  return String(result.stdout || '').trim() || null
}

function readPackageJson(cwd) {
  const filePath = path.join(cwd, 'package.json')
  if (!fs.existsSync(filePath)) return null
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return null }
}

function detectProjectType({ packageJson }) {
  if (!packageJson) return 'generic repository'
  if (packageJson.bin) return 'CLI / tool project'
  if (packageJson.dependencies?.next) return 'Next.js application'
  if (packageJson.dependencies?.react || packageJson.devDependencies?.react) return 'React application'
  if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) return 'Vite application'
  return 'Node.js / JavaScript project'
}

function detectPrimaryLanguage(cwd) {
  if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) return 'TypeScript'
  if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'requirements.txt'))) return 'Python'
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) return 'Rust'
  if (fs.existsSync(path.join(cwd, 'go.mod'))) return 'Go'
  if (fs.existsSync(path.join(cwd, 'package.json'))) return 'JavaScript / TypeScript'
  return 'Mixed / unknown'
}

function collectProjectContext({ cwd, action, model }) {
  const packageJson = readPackageJson(cwd)
  const repoName = packageJson?.name || path.basename(cwd)
  return {
    cwd,
    repoName,
    displayName: toTitleCase(repoName),
    packageJson,
    packageManager: detectPackageManager(cwd),
    remote: detectGitRemote(cwd),
    branch: detectCurrentBranch(cwd),
    projectType: detectProjectType({ packageJson }),
    primaryLanguage: detectPrimaryLanguage(cwd),
    action: action || 'Initialize project',
    selectedModel: model || null,
  }
}

function renderProjectMarkdown(context) {
  const remoteLine = context.remote ? `- Remote: ${context.remote}` : '- Remote: (none detected yet)'
  return `---
purpose: Project identity and goals for repo-local ZCode context
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# ${context.displayName}

## Repository Identity

- Repo name: ${context.repoName}
- Working directory: ${context.cwd}
${remoteLine}
- Branch: ${context.branch || '(not detected)'}
- Project type: ${context.projectType}
- Primary language: ${context.primaryLanguage}

## Why this file exists

This project memory was generated from the current repository during 'zcs install' / 'zcode-starterkit install'.
It should describe **this repo**, not the starterkit baseline donor project.

## Initial Objective

- Action selected during install: ${context.action}
- Selected model override: ${context.selectedModel || 'inherit / global default'}
- Immediate goal: bootstrap a thin ZCode overlay with project-local memory.
`
}

function renderStateMarkdown(context) {
  return `---
purpose: Current repo-local working state for ZCode prompt injection
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# State

## Current Position

- Status: Newly initialized ZCode project overlay
- Install action: ${context.action}
- Selected model override: ${context.selectedModel || 'inherit / global default'}
- Branch at install time: ${context.branch || '(not detected)'}

## What has been created

- .zcode/config.json
- .zcode/memory/project/*.md
- .zcode/memory/_templates/*.md
- .zcode/memory/research/*.md

## Next Actions

1. Replace generated placeholder context with real project intent.
2. Confirm runtime model/provider choices for this repo.
3. Capture repo-specific gotchas once actual work starts.
`
}

function renderRoadmapMarkdown(context) {
  return `---
purpose: Initial roadmap scaffold for repo-local ZCode context
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# Roadmap

## Bootstrap Phase

- [x] Install thin ZCode overlay into this repository
- [x] Generate repo-local memory files from detected repo context
- [ ] Replace placeholder roadmap with project-specific milestones

## Suggested Next Milestones

1. Confirm product / engineering objective for ${context.repoName}
2. Define verification commands and constraints
3. Capture first meaningful state update after real implementation work
`
}

function renderTechStackMarkdown(context) {
  const packageManagerLine = context.packageManager ? `- Package manager: ${context.packageManager}` : '- Package manager: (not detected)'
  const scripts = Object.keys(context.packageJson?.scripts || {})
  const scriptLines = scripts.length > 0 ? scripts.map((name) => `- ${name}`).join('\n') : '- (no scripts detected)'
  return `---
purpose: Detected stack and constraints for repo-local ZCode context
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# Tech Stack

## Detected Shape

- Project type: ${context.projectType}
- Primary language: ${context.primaryLanguage}
${packageManagerLine}
- package.json name: ${context.packageJson?.name || '(none)'}
- package.json version: ${context.packageJson?.version || '(none)'}

## Detected Scripts

${scriptLines}
`
}

function renderUserMarkdown(context) {
  return `---
purpose: Repo-local workflow preferences scaffold
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# User / Workflow Notes

## Install Context

- Generated for repo: ${context.repoName}
- Generated by action: ${context.action}
- Selected model override: ${context.selectedModel || 'inherit / global default'}

## Safe Defaults

- Ask before commit / push unless explicitly requested
- Keep repo-specific context here, not in the global baseline
`
}

function renderGotchasMarkdown(context) {
  return `---
purpose: Repo-local gotchas scaffold
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# Gotchas

## Bootstrap Gotcha

- If this file mentions another project, the install flow is wrong.
- Repo-local memory must always describe the current repo: ${context.repoName}

## To Fill In Later

- runtime footguns
- environment traps
- project-specific conventions
`
}

export function renderProjectMemoryFiles({ cwd, action, model }) {
  const context = collectProjectContext({ cwd, action, model })
  const rendered = {
    'project.md': renderProjectMarkdown(context),
    'state.md': renderStateMarkdown(context),
    'roadmap.md': renderRoadmapMarkdown(context),
    'tech-stack.md': renderTechStackMarkdown(context),
    'user.md': renderUserMarkdown(context),
    'gotchas.md': renderGotchasMarkdown(context),
  }
  for (const name of PROJECT_MEMORY_FILES) if (!rendered[name]) rendered[name] = `# ${name}\n`
  return rendered
}

export function renderProjectZcodeJson({ model }) {
  const base = {
    $schema: 'https://opencode.ai/config.json',
    instructions: [
      '.zcode/memory/project/user.md',
      '.zcode/memory/project/tech-stack.md',
      '.zcode/memory/project/project.md',
      '.zcode/memory/project/roadmap.md',
      '.zcode/memory/project/state.md',
    ],
  }
  if (model) base.model = model
  return `${JSON.stringify(base, null, '\t')}\n`
}
