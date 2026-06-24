import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { backupIfExists, copyDirMissing, shouldCopyStarterkitPath } from '../src/fs-utils.mjs'
import { mergeZcodeConfigAdditive } from '../src/config-merge.mjs'

test('shouldCopyStarterkitPath denies runtime artifacts', () => {
  assert.equal(shouldCopyStarterkitPath('node_modules', null), false)
  assert.equal(shouldCopyStarterkitPath('memory.db', null), false)
  assert.equal(shouldCopyStarterkitPath('src/skill.md', null), true)
})

test('backupIfExists creates a timestamped backup and leaves original', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-safe-'))
  const src = path.join(dir, 'file.json')
  const backupRoot = path.join(dir, 'backups')
  fs.writeFileSync(src, '{}')
  const backup = backupIfExists(src, { backupRoot })
  assert.ok(backup)
  assert.ok(fs.existsSync(backup))
  assert.ok(fs.existsSync(src), 'original must remain after backup')
})

test('copyDirMissing preserves existing targets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-copy-'))
  const from = path.join(dir, 'from')
  const to = path.join(dir, 'to')
  fs.mkdirSync(path.join(from, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(from, 'sub', 'a.txt'), 'A')
  fs.mkdirSync(path.join(to, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(to, 'sub', 'a.txt'), 'EXISTING')
  const result = copyDirMissing(from, to)
  assert.ok(result.preserved.some((p) => p.endsWith('a.txt')))
  assert.equal(fs.readFileSync(path.join(to, 'sub', 'a.txt'), 'utf8'), 'EXISTING')
})

test('merge never overwrites a scalar current value with a baseline scalar', () => {
  const current = { share: 'manual', model: 'glm-5.2' }
  const baseline = { share: 'auto', model: 'github-copilot/gpt-5.5' }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  assert.equal(merged.share, 'manual', 'current scalar preserved')
  assert.equal(merged.model, 'glm-5.2', 'current scalar preserved')
})
