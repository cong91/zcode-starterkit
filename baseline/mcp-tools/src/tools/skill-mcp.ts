// skill-mcp tools — ported (reduced) from opencode-starterkit
// baseline/plugin/skill-mcp.ts. Exposed as MCP tools on the mcp-tools server.
//
// OpenCode's skill-mcp loaded MCP configs declared in skill frontmatter and
// spawned child-process MCP clients on demand, exposing skill_mcp /
// skill_mcp_status / skill_mcp_disconnect tools. ZCode already has native
// mcpServers support in plugin.json, so this port is REDUCED to two manual
// tools for the case where a skill carries an ad-hoc MCP config that isn't
// registered as a native plugin:
//   - skill_mcp_list   — scan a skills directory for MCP frontmatter configs
//   - skill_mcp_connect — spawn an MCP server by config and list its tools
//
// This complements (does not duplicate) ZCode's native mcpServers: native
// servers are always-on; these tools are for on-demand, skill-scoped servers.

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  includeTools?: string[]
}

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) return { frontmatter: {}, body: content }
  const fm: Record<string, unknown> = {}
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([\w-]+):\s*(.*)$/)
    if (mm) {
      let v: unknown = mm[2].trim()
      if ((v as string).startsWith('[')) {
        try { v = JSON.parse(v as string) } catch { /* keep string */ }
      }
      fm[mm[1]] = v
    }
  }
  return { frontmatter: fm, body: m[2] }
}

function resolveSkillsDir(): string {
  if (process.env.ZCODE_SKILLS_DIR) return process.env.ZCODE_SKILLS_DIR
  const cwd = process.env.ZCODE_PROJECT_DIR || process.cwd()
  // Default: the starterkit core plugin skills dir, if installed
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const pluginSkills = path.join(home, '.zcode', 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', '0.1.0', 'skills')
  if (fs.existsSync(pluginSkills)) return pluginSkills
  return path.join(cwd, 'baseline', 'skills')
}

// --- skill_mcp_list ---

export const skillMcpListTool = {
  name: 'skill_mcp_list',
  description: `Scan a skills directory for skills that declare an MCP server config in their SKILL.md frontmatter (mcp.server / mcp.command / mcpServers). Lists which skills carry ad-hoc MCP configs that skill_mcp_connect can spawn on demand.

Example:
skill_mcp_list({})`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      skills_dir: { type: 'string', description: 'Skills directory to scan (default: installed core plugin skills)' },
    },
  },
}

async function skillMcpListExecute(args: { skills_dir?: string }): Promise<string> {
  const dir = args.skills_dir ? path.resolve(args.skills_dir) : resolveSkillsDir()
  if (!fs.existsSync(dir)) return `Skills directory not found: ${dir}`
  const results: Array<{ skill: string; servers: Record<string, McpServerConfig> }> = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillMd = path.join(dir, entry.name, 'SKILL.md')
    if (!fs.existsSync(skillMd)) continue
    const { frontmatter } = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'))
    const mcp = (frontmatter.mcp || frontmatter.mcpServers) as Record<string, McpServerConfig> | undefined
    if (mcp && typeof mcp === 'object') results.push({ skill: entry.name, servers: mcp })
  }
  if (results.length === 0) return `No skills with MCP configs found under ${dir}.`
  const lines = [`Found ${results.length} skill(s) with MCP configs:`]
  for (const r of results) {
    lines.push(`- ${r.skill}: ${Object.keys(r.servers).join(', ')}`)
    for (const [name, cfg] of Object.entries(r.servers)) {
      lines.push(`    - ${name}: ${cfg.command} ${(cfg.args || []).join(' ')}`)
    }
  }
  return lines.join('\n')
}

// --- skill_mcp_connect ---

export const skillMcpConnectTool = {
  name: 'skill_mcp_connect',
  description: `Spawn an MCP server from a skill's frontmatter config (or an explicit command) over stdio, perform the MCP initialize + tools/list handshake, and return the available tool names. Use for on-demand, skill-scoped MCP servers not registered as native ZCode mcpServers.

Example:
skill_mcp_connect({ command: "npx", args: ["-y", "some-mcp-server"] })
skill_mcp_connect({ skill: "playwright", server: "browser" })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      skill: { type: 'string', description: 'Skill name (looks up its frontmatter MCP config)' },
      server: { type: 'string', description: 'Server name within the skill config (if multiple)' },
      command: { type: 'string', description: 'Explicit command to spawn (overrides skill lookup)' },
      args: { type: 'array', items: { type: 'string' }, description: 'Args for the explicit command' },
      env: { type: 'object', description: 'Env vars for the spawned server' },
    },
  },
}

async function skillMcpConnectExecute(args: {
  skill?: string
  server?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}): Promise<string> {
  let command = args.command
  let cmdArgs = args.args || []
  let env = args.env || {}
  if (!command && args.skill) {
    const dir = resolveSkillsDir()
    const skillMd = path.join(dir, args.skill, 'SKILL.md')
    if (!fs.existsSync(skillMd)) return `Skill not found: ${args.skill} (looked in ${dir})`
    const { frontmatter } = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'))
    const mcp = (frontmatter.mcp || frontmatter.mcpServers) as Record<string, McpServerConfig> | undefined
    if (!mcp) return `Skill ${args.skill} has no MCP config in its frontmatter.`
    const serverName = args.server || Object.keys(mcp)[0]
    const cfg = mcp[serverName]
    if (!cfg) return `Server "${serverName}" not found in skill ${args.skill}. Available: ${Object.keys(mcp).join(', ')}`
    command = cfg.command
    cmdArgs = cfg.args || []
    env = cfg.env || {}
  }
  if (!command) return 'Either command or skill must be provided.'

  return new Promise((resolve) => {
    const child = spawn(command!, cmdArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      timeout: 30_000,
    })
    let buffer = ''
    let settled = false
    const finish = (out: string) => {
      if (settled) return
      settled = true
      try { child.kill() } catch { /* */ }
      resolve(out)
    }
    const send = (obj: unknown) => child.stdin.write(JSON.stringify(obj) + '\n')
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      for (const line of buffer.split('\n')) {
        if (!line.trim()) continue
        let msg: { id?: number; result?: { capabilities?: { tools?: unknown }; tools?: Array<{ name: string }> }; error?: { message?: string } }
        try { msg = JSON.parse(line) } catch { continue }
        if (msg.id === 1) {
          // initialize response → request tools/list
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
        } else if (msg.id === 2) {
          const tools = (msg.result?.tools || []).map((t) => t.name)
          finish(`Connected to MCP server "${command}". Available tools (${tools.length}):\n${tools.map((t) => `  - ${t}`).join('\n')}`)
        }
      }
    })
    child.stderr.on('data', () => { /* ignore stderr noise */ })
    child.on('error', (err) => finish(`Failed to spawn MCP server "${command}": ${err.message}`))
    child.on('close', (code) => {
      if (!settled) finish(`MCP server "${command}" exited with code ${code} before completing handshake.`)
    })
    // Kick off the handshake
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'zcode-starterkit-skill-mcp', version: '0.1.0' } } })
    // Safety timeout
    setTimeout(() => finish(`MCP handshake with "${command}" timed out after 30s.`), 30_000)
  })
}

export const skillMcpTools = [skillMcpListTool, skillMcpConnectTool]

export const skillMcpExecute: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  skill_mcp_list: skillMcpListExecute as (a: Record<string, unknown>) => Promise<unknown>,
  skill_mcp_connect: skillMcpConnectExecute as (a: Record<string, unknown>) => Promise<unknown>,
}
