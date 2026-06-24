// esbuild bundle: produce a single self-contained dist/mcp/server.js so the
// ZCode plugin host can run it with `node` without a node_modules install.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/mcp/server.js',
  banner: { js: '#!/usr/bin/env node' },
  // node:sqlite and node:* are built-in; keep them external.
  external: [],
  logLevel: 'info',
})

console.log('built dist/mcp/server.js')
