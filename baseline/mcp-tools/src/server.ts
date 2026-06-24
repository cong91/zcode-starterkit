// ZCode MCP server for zcode-starterkit — exposes OpenCode baseline tools
// (context7, grepsearch, csearch, memory, sessions) as MCP tools.
//
// Reduced port: ZCode has no OpenCode event bus (message.part.updated /
// messages.transform / system.transform), so auto-capture/inject is gone.
// Tools are called manually by the agent over the MCP stdio transport.
//
// Build: `npm run build` (esbuild bundles to dist/mcp/server.js, self-contained).
// Run:   `node dist/mcp/server.js` (ZCode plugin host launches this via mcpServers).

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { context7Tool, context7Execute } from './tools/context7.js'
import { grepsearchTool, grepsearchExecute } from './tools/grepsearch.js'
import { csearchTool, csearchExecute } from './tools/csearch.js'
import { memoryTools, memoryExecute } from './tools/memory.js'
import { sessionsTools, sessionsExecute } from './tools/sessions.js'
import { srcwalkTools, srcwalkExecute } from './tools/srcwalk.js'
import { skillMcpTools, skillMcpExecute } from './tools/skill-mcp.js'

const ALL_TOOLS = [
  context7Tool,
  grepsearchTool,
  csearchTool,
  ...memoryTools,
  ...sessionsTools,
  ...srcwalkTools,
  ...skillMcpTools,
]

const EXECUTORS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  context7: context7Execute as (a: Record<string, unknown>) => Promise<unknown>,
  grepsearch: grepsearchExecute as (a: Record<string, unknown>) => Promise<unknown>,
  csearch: csearchExecute as (a: Record<string, unknown>) => Promise<unknown>,
  ...memoryExecute,
  ...sessionsExecute,
  ...srcwalkExecute,
  ...skillMcpExecute,
}

const server = new Server(
  { name: 'zcode-starterkit-tools', version: '0.1.0' },
  {
    capabilities: { tools: {} },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const executor = EXECUTORS[name]
  if (!executor) {
    return {
      content: [{ type: 'text', text: `Error: unknown tool "${name}". Available: ${Object.keys(EXECUTORS).join(', ')}` }],
      isError: true,
    }
  }
  try {
    const result = await executor((args || {}) as Record<string, unknown>)
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    return { content: [{ type: 'text', text }] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { content: [{ type: 'text', text: `Error executing ${name}: ${message}` }], isError: true }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('[zcode-starterkit-mcp] fatal:', error)
  process.exit(1)
})
