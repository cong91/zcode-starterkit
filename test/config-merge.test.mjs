import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeZcodeConfigAdditive, normalizeZcodeConfig } from '../src/config-merge.mjs'

test('additive merge adds missing keys without overwriting existing', () => {
  const current = { provider: { 'builtin:zai': { name: 'Z.ai' } }, model: 'glm-5.2' }
  const baseline = { provider: { 'github-copilot': { name: 'Copilot' } }, mcp: { tilth: { command: ['npx'] } } }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  assert.equal(merged.model, 'glm-5.2')
  assert.equal(merged.provider['builtin:zai'].name, 'Z.ai')
  assert.equal(merged.provider['github-copilot'].name, 'Copilot')
  assert.equal(merged.mcp.tilth.command[0], 'npx')
})

test('normalize removes invalid model refs when provider missing', () => {
  const current = { provider: { 'builtin:zai': {} } }
  const baseline = { model: 'github-copilot/gpt-5.5', small_model: 'opencode/gpt-5-nano', agent: { build: { model: 'github-copilot/gpt-5.5', description: 'dev' } } }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  const norm = normalizeZcodeConfig({ current, baseline, merged })
  assert.equal(norm.config.model, undefined)
  assert.equal(norm.config.small_model, undefined)
  assert.equal(norm.config.agent.build.model, undefined)
  assert.equal(norm.config.agent.build.description, 'dev')
  const removed = norm.changes.filter((c) => c.type === 'model_removed' || c.type === 'agent_model_removed')
  assert.ok(removed.length >= 2)
})

test('normalize keeps valid model refs when provider present', () => {
  const current = { provider: { 'builtin:zai': {} } }
  const baseline = { model: 'builtin:zai/glm-5.2' }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  const norm = normalizeZcodeConfig({ current, baseline, merged })
  assert.equal(norm.config.model, 'builtin:zai/glm-5.2')
})

test('merge never introduces a plugin[] array from baseline', () => {
  const current = {}
  const baseline = { plugin: ['@x/opencode-dcp'] }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  assert.equal(merged.plugin, undefined)
})
