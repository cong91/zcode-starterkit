---
name: compaction
description: >
  Use when context is growing large during long-running tasks and needs server-side or client-side
  summarization to continue effectively. Covers compaction triggers, custom summarization patterns,
  session handoff, and context preservation strategies.
version: 1.0.0
tags: [context, workflow]
dependencies: []
---

# Context Compaction - Managing Long-Running Sessions

## When to Use

- Context is growing large and needs compression/cleanup to continue.

## When NOT to Use

- Short sessions with low context usage where no compaction is needed.


## Overview

**Compaction = Summarization + Preservation + Continuity**

Long-running sessions accumulate context (tool outputs, code reads, exploration results). When context approaches limits, compaction reduces it to essential information while preserving decision history and work state.

## Context Budget Awareness

### Token Thresholds

| Context Usage | Status      | Action                                        |
| ------------- | ----------- | --------------------------------------------- |
| 0-50%         | 🟢 Normal   | Work freely                                   |
| 50-70%        | 🟡 Watch    | Start compressing completed explorations      |
| 70-85%        | 🟠 Compact  | Actively compress and sweep stale noise       |
| 85-95%        | 🔴 Critical | Emergency compaction, prepare session handoff |
| 95%+          | ⛔ Limit    | Session handoff required                      |

### Monitoring

Pay attention to these signals:

- Completed phases accumulating without being compressed
- Repeated file reads of the same content
- Large bash outputs from builds/tests
- Multiple exploration rounds without synthesis

## Compaction Strategies

### Strategy 1: Phase Compression (Preferred)

Compress completed conversation phases into dense summaries. This is the primary DCP instrument in the installed beta.


Compress completed conversation phases into dense summaries.

```
WHEN: A research phase is complete and findings are clear
DO: compress({
  topic: "Auth Research Complete",
  content: {
    startString: "unique text at phase start",
    endString: "unique text at phase end",
    summary: "Complete technical summary of findings..."
  }
})
```

**Key principle**: Only compress CLOSED chapters. Never compress active work.

### Strategy 2: Sweep Stale Noise

Use `/dcp sweep` after a phase is complete to remove stale/noisy content automatically.

```
WHEN: Wrong-target searches or superseded outputs are no longer needed
DO: /dcp sweep
```

**Key principle**: Sweep only after the relevant phase is closed. If in doubt, keep it.

### Strategy 3: Session Handoff

When context is too large to compact further, hand off to a new session.

```
WHEN: Context > 85% and significant work remains
DO:
  1. Create handoff document with memory-update
  2. Save all decisions with observation tool
  3. Document current state and remaining work
  4. Start new session with handoff reference
```

## Compaction Decision Tree

```
Is context growing large?
├── NO → Continue working normally
└── YES → What type of content is consuming space?
    ├── Completed conversation phases → COMPRESS
    ├── Stale/noisy closed-phase outputs → SWEEP
    └── Everything is still relevant → SESSION HANDOFF
```

## Custom Summarization Patterns

### For Code Exploration

```markdown
## Exploration Summary: [Component/Module]

### Architecture

- Entry point: `src/auth/index.ts`
- Key classes: AuthService, TokenManager, SessionStore
- Dependencies: jwt, bcrypt, redis

### Key Findings

- Auth flow: login → validate → issue JWT → store session
- Token rotation: every 15 minutes via refresh endpoint
- Session storage: Redis with 24h TTL

### Decisions Made

- Use existing TokenManager (don't replace)
- Add rate limiting to login endpoint
- Migrate session store from memory to Redis

### Files to Modify

- src/auth/service.ts (add rate limiting)
- src/auth/session.ts (Redis integration)
- src/config/redis.ts (new file)
```

### For Implementation Phase

```markdown
## Implementation Summary: [Feature]

### Completed

- [x] Database schema migration (src/db/migrations/004_auth.ts)
- [x] API endpoints (src/routes/auth.ts) - 3 new routes
- [x] Frontend forms (src/components/auth/) - Login, Register, Reset

### Verification

- TypeScript: ✅ passing
- Tests: ✅ 12/12 passing
- Lint: ✅ no issues

### Remaining

- [ ] Email verification flow
- [ ] Rate limiting middleware

### Key Decisions

- JWT expiry: 15 minutes (refresh: 7 days)
- Password hashing: bcrypt with 12 rounds
- Session storage: Redis (not in-memory)
```

### For Debugging

```markdown
## Debug Summary: [Issue]

### Symptoms

- Error: "TypeError: Cannot read property 'id' of undefined"
- Location: src/auth/middleware.ts:42
- Trigger: POST /api/protected when token is expired

### Root Cause

- Token validation returns null on expired tokens
- Middleware assumes valid token object, no null check
- Race condition: token expires between validation and use

### Fix Applied

- Added null check in middleware (src/auth/middleware.ts:42)
- Added token refresh attempt before rejecting (src/auth/refresh.ts)
- Added test for expired token scenario (src/auth/**tests**/middleware.test.ts)

### Verification

- Tests: ✅ all passing including new test
- Manual: ✅ expired token now triggers refresh
```

## Session Handoff Protocol

When you must hand off to a new session:

### 1. Create Handoff Document

```typescript
memory -
  update({
    file: "handoffs/YYYY-MM-DD-feature-name",
    content: `# Session Handoff: [Feature Name]

## Context
[Why this session started, what was the goal]

## Completed Work
[What was done, files changed, decisions made]

## Current State
[Where things stand right now]

## Remaining Work
[What still needs to be done]

## Key Decisions
[Important choices made and why]

## Files Modified
[List of all files changed with brief description]

## Gotchas
[Things the next session should know]
  `,
    mode: "replace",
  });
```

### 2. Save Key Observations

```typescript
observation({
  type: "decision",
  title: "Auth implementation approach",
  narrative: "Chose JWT with Redis sessions because...",
  facts: "JWT 15min expiry, Redis 24h TTL, bcrypt 12 rounds",
  concepts: "authentication, sessions, tokens",
  confidence: "high",
});
```

### 3. Resume in New Session

```typescript
// In new session:
memory - read({ file: "handoffs/YYYY-MM-DD-feature-name" });
memory - search({ query: "auth implementation" });
```

## Integration with DCP Plugin

This project uses `@tarquinen/opencode-dcp` for always-on context management (injected via `experimental.chat.system.transform`):

- **compress**: Phase-level conversation compression (primary DCP tool in the installed beta)
- **/dcp sweep**: Cleanup command for stale/noisy content after a phase is complete
- **Prunable-tools list**: Auto-injected into messages with token estimates
- **Nudge system**: Reminders every N tool calls + critical limit warnings

**Division of responsibility:**

- **DCP plugin**: Context budget rules, tool guidance, prunable-tools list, nudges (always present via system prompt)
- **Compaction plugin** (`.opencode/plugin/compaction.ts`): Session continuity, beads state, handoff recovery, post-compaction protocol (fires during compaction events only)

## Anti-Patterns

### ❌ Premature Compaction

```
// DON'T compress a file you're about to edit
compress({ ... })  // Loses exact line numbers you need
edit({ ... })      // Now you can't find the right location
```

**Fix**: Keep raw content while actively editing. Compress AFTER the edit phase.

### ❌ Compressing Active Work

```
// DON'T compress a conversation phase you might return to
compress({ summary: "Explored auth options" })
// Later: "Wait, which options did we consider?"
```

**Fix**: Only compress CLOSED chapters where findings are crystallized.

### ❌ Ignoring Context Growth

```
// DON'T let context grow unchecked until hitting limits
// By the time you notice, emergency compaction loses information
```

**Fix**: Monitor regularly. Compress at natural breakpoints and use `/dcp sweep` after closed phases.

## Checklist

Before compacting:

- [ ] Identified what type of content is consuming context
- [ ] Chosen appropriate strategy (compress/sweep/handoff)
- [ ] Verified raw content is no longer needed for active work
- [ ] Captured all key details in the compression summary or handoff
- [ ] Saved important decisions as observations
- [ ] Created handoff document if switching sessions

During long sessions:

- [ ] Compressing completed phases at natural breakpoints
- [ ] Sweeping stale/noisy outputs after phase completion
- [ ] Monitoring context usage trends
- [ ] Planning session handoff if approaching limits
