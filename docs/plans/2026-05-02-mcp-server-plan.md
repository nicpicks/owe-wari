# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MCP (Model Context Protocol) server endpoint to owe-wari so AI assistants can read groups, log expenses, and settle debts on behalf of the user via natural language.

**Architecture:** A single Next.js App Router route at `/api/mcp/[transport]` using `@vercel/mcp-adapter`. The route validates a shared-secret Bearer token, then exposes 7 tools that delegate to the existing tRPC server caller (`~/trpc/server`). No new business logic — the MCP layer is a thin adapter. Group discovery is by ULID only (no list-all endpoint); the AI keeps known group IDs in its own memory.

**Tech Stack:** Next.js 14 App Router, `@vercel/mcp-adapter`, existing tRPC server caller, Zod for tool input schemas.

---

## File Structure

**New files:**
- `src/app/api/mcp/[transport]/route.ts` — the MCP HTTP route. Auth guard + adapter mount.
- `src/server/mcp/tools.ts` — tool definitions (Zod schemas + handlers that call the tRPC caller).
- `src/server/mcp/auth.ts` — shared-secret Bearer token validator.
- `src/env.js` modifications — register `MCP_API_TOKEN` env var.
- `docs/MCP.md` — maintenance guide for future contributors (human + AI). Lists every tool, its tRPC backing, and the rule that **adding a mutation tRPC procedure requires evaluating whether to expose it via MCP**.
- `tests/e2e/mcp-auth.spec.ts` — Playwright e2e for the auth guard (the only piece worth testing automatically; tool wiring is best verified manually with MCP Inspector).

**Modified files:**
- `package.json` — add `@vercel/mcp-adapter` dependency.
- `CLAUDE.md` — add a one-line pointer to `docs/MCP.md` so future contributors are routed to it when touching tRPC.
- `.env.example` — document `MCP_API_TOKEN`.

**Why this structure:**
- The route handler stays tiny; tool definitions live next to the server (`src/server/mcp/`) where they can import the tRPC caller cleanly.
- Auth is its own module so the unit of behavior is testable in isolation and reusable if a second protected route is ever added.
- The maintenance doc lives at `docs/MCP.md` (not buried in `docs/plans/`) because it's living reference material, not a one-shot plan.

---

## Task 1: Add dependency and env var scaffolding

**Files:**
- Modify: `package.json`
- Modify: `src/env.js`
- Modify: `.env.example`

- [ ] **Step 1: Install adapter**

```bash
npm install @vercel/mcp-adapter
```

Expected: package installed, `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Register env var in `src/env.js`**

Find the `server: { ... }` block in `src/env.js` and add `MCP_API_TOKEN`:

```js
server: {
    POSTGRES_URL: z.string().url(),
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    MCP_API_TOKEN: z.string().min(32),
},
```

Then in the `runtimeEnv: { ... }` block, add:

```js
MCP_API_TOKEN: process.env.MCP_API_TOKEN,
```

- [ ] **Step 3: Document in `.env.example`**

Append to `.env.example`:

```
# Shared secret for the MCP endpoint at /api/mcp.
# Generate with: openssl rand -hex 32
MCP_API_TOKEN=""
```

- [ ] **Step 4: Generate a local token and add to `.env`**

```bash
echo "MCP_API_TOKEN=\"$(openssl rand -hex 32)\"" >> .env
```

- [ ] **Step 5: Verify dev server still boots**

```bash
npm run dev
```

Expected: server starts on port 3000 with no env validation errors. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/env.js .env.example
git commit -m "chore(mcp): add @vercel/mcp-adapter and MCP_API_TOKEN env var"
```

---

## Task 2: Implement the auth guard

**Files:**
- Create: `src/server/mcp/auth.ts`

- [ ] **Step 1: Write the auth guard**

Create `src/server/mcp/auth.ts`:

```ts
import { env } from '~/env'

/**
 * Validates the Authorization header against MCP_API_TOKEN.
 * Returns null on success, or a Response with the appropriate status on failure.
 *
 * Constant-time comparison is not strictly required here because the token is a
 * 256-bit random hex string — guessing or timing-leaking a single byte does not
 * reduce the search space meaningfully. We still avoid logging the header.
 */
export function checkMcpAuth(req: Request): Response | null {
    const header = req.headers.get('authorization')
    if (!header) {
        return new Response('Unauthorized: missing Authorization header', { status: 401 })
    }
    const match = /^Bearer\s+(.+)$/i.exec(header)
    if (!match) {
        return new Response('Unauthorized: malformed Authorization header', { status: 401 })
    }
    const token = match[1]!.trim()
    if (token !== env.MCP_API_TOKEN) {
        return new Response('Unauthorized: invalid token', { status: 401 })
    }
    return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/mcp/auth.ts
git commit -m "feat(mcp): add bearer token auth guard"
```

---

## Task 3: Define MCP tool catalog

**Files:**
- Create: `src/server/mcp/tools.ts`

- [ ] **Step 1: Write tool definitions**

Create `src/server/mcp/tools.ts`. This file declares all tools as a single object. Each tool has a Zod input schema and an async handler that delegates to `~/trpc/server`'s `api` caller.

```ts
import { z } from 'zod'
import { api } from '~/trpc/server'

/**
 * Tool catalog for the owe-wari MCP server.
 *
 * Each tool delegates to a tRPC procedure — no business logic lives here.
 * When you add a new tRPC mutation that callers might want to invoke via
 * natural language, add it here too. See docs/MCP.md.
 */

const groupIdSchema = z.string().length(26).describe('The group ULID (26 chars). Find this in the group URL.')

export const mcpTools = {
    get_group: {
        description:
            'Get a group by its ULID, including members and enabled currencies. Use this to confirm a group exists and to discover member IDs and currency codes before creating expenses or settling up.',
        inputSchema: { groupId: groupIdSchema },
        handler: async ({ groupId }: { groupId: string }) => {
            const [group, members, currencies] = await Promise.all([
                api.group.getGroup({ groupId }),
                api.group.getUsers({ groupId }),
                api.group.getCurrencies({ groupId }),
            ])
            if (!group) throw new Error(`Group ${groupId} not found`)
            return { group, members, currencies }
        },
    },

    list_expenses: {
        description: 'List all expenses in a group. Returns id, title, amount, currency, category, notes, and date for each.',
        inputSchema: { groupId: groupIdSchema },
        handler: async ({ groupId }: { groupId: string }) =>
            api.expense.getExpenses({ groupId }),
    },

    get_expense: {
        description: 'Get full details of a single expense by its numeric ID, including the per-user split breakdown.',
        inputSchema: {
            expenseId: z.number().int().positive().describe('The numeric expense ID'),
        },
        handler: async ({ expenseId }: { expenseId: number }) =>
            api.expense.getExpense({ expenseId }),
    },

    create_expense: {
        description:
            'Create a new expense in a group. CONFIRM WITH THE USER before calling. Splits are even across all members by default; pass splitAmounts to override.',
        inputSchema: {
            groupId: groupIdSchema,
            paidByUserId: z.string().length(26).describe('The ULID of the user who paid'),
            title: z.string().min(1),
            amount: z.number().positive(),
            currency: z
                .string()
                .length(3)
                .describe('3-letter ISO currency code, must be enabled for the group'),
            category: z.string().optional(),
            notes: z.string().optional(),
            expenseDate: z
                .string()
                .datetime()
                .optional()
                .describe('ISO 8601 datetime; defaults to now'),
            splitUserIds: z
                .array(z.string().length(26))
                .optional()
                .describe('User IDs to split across (even split). Omit to split across all members.'),
            splitAmounts: z
                .array(z.object({ userId: z.string().length(26), amount: z.number().positive() }))
                .optional()
                .describe('Manual split amounts. Sum must equal `amount`. Mutually exclusive with splitUserIds.'),
        },
        handler: async (input: {
            groupId: string
            paidByUserId: string
            title: string
            amount: number
            currency: string
            category?: string
            notes?: string
            expenseDate?: string
            splitUserIds?: string[]
            splitAmounts?: { userId: string; amount: number }[]
        }) =>
            api.expense.create({
                ...input,
                expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
            }),
    },

    get_balances: {
        description:
            'Get net balances per (user, currency) for a group. Positive netBalance means the user is owed; negative means they owe.',
        inputSchema: { groupId: groupIdSchema },
        handler: async ({ groupId }: { groupId: string }) =>
            api.expense.getBalances({ groupId }),
    },

    settle_up: {
        description:
            'Record a settlement payment from one user to another. CONFIRM WITH THE USER before calling. Supports multi-currency lines (e.g., paying back $30 USD plus S$50 SGD in one settlement).',
        inputSchema: {
            groupId: groupIdSchema,
            payerId: z.string().length(26).describe('User who is paying'),
            receiverId: z.string().length(26).describe('User receiving the payment'),
            lines: z
                .array(
                    z.object({
                        currency: z.string().length(3),
                        amount: z.number().positive(),
                    })
                )
                .min(1),
        },
        handler: async (input: {
            groupId: string
            payerId: string
            receiverId: string
            lines: { currency: string; amount: number }[]
        }) => api.expense.settleUp(input),
    },

    add_member: {
        description: 'Add a new member to a group by name. CONFIRM WITH THE USER before calling. Returns the new member ID.',
        inputSchema: {
            groupId: groupIdSchema,
            name: z.string().min(1),
        },
        handler: async (input: { groupId: string; name: string }) =>
            api.group.addMember(input),
    },
} as const
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. (If `~/trpc/server`'s `api` doesn't expose any of these procedures, the call sites will surface that here.)

- [ ] **Step 3: Commit**

```bash
git add src/server/mcp/tools.ts
git commit -m "feat(mcp): define tool catalog backed by tRPC server caller"
```

---

## Task 4: Mount the MCP route handler

**Files:**
- Create: `src/app/api/mcp/[transport]/route.ts`

- [ ] **Step 1: Write the route handler**

Create `src/app/api/mcp/[transport]/route.ts`:

```ts
import { createMcpHandler } from '@vercel/mcp-adapter'
import { z } from 'zod'

import { checkMcpAuth } from '~/server/mcp/auth'
import { mcpTools } from '~/server/mcp/tools'

const handler = createMcpHandler(
    (server) => {
        for (const [name, def] of Object.entries(mcpTools)) {
            server.tool(
                name,
                def.description,
                def.inputSchema as Record<string, z.ZodTypeAny>,
                async (input: unknown) => {
                    const result = await def.handler(input as never)
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                    }
                }
            )
        }
    },
    {},
    { basePath: '/api/mcp' }
)

async function withAuth(req: Request): Promise<Response> {
    const authError = checkMcpAuth(req)
    if (authError) return authError
    return handler(req)
}

export { withAuth as GET, withAuth as POST, withAuth as DELETE }
```

- [ ] **Step 2: Boot dev server and hit the endpoint without auth**

```bash
npm run dev
```

In a second terminal:

```bash
curl -i http://localhost:3000/api/mcp/mcp
```

Expected: `HTTP/1.1 401 Unauthorized` with body `Unauthorized: missing Authorization header`.

- [ ] **Step 3: Hit with the wrong token**

```bash
curl -i -H "Authorization: Bearer wrongtoken" http://localhost:3000/api/mcp/mcp
```

Expected: `HTTP/1.1 401 Unauthorized` with body `Unauthorized: invalid token`.

- [ ] **Step 4: Hit with the correct token**

```bash
TOKEN=$(grep MCP_API_TOKEN .env | cut -d= -f2 | tr -d '"')
curl -i -H "Authorization: Bearer $TOKEN" -H "Accept: application/json, text/event-stream" -X POST http://localhost:3000/api/mcp/mcp -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

Expected: `HTTP/1.1 200 OK` with a JSON-RPC initialization response containing `serverInfo` and `capabilities`. Stop dev server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/[transport]/route.ts
git commit -m "feat(mcp): mount /api/mcp route with bearer auth"
```

---

## Task 5: End-to-end verify with MCP Inspector

**Files:** none — this is a manual verification task. The output is confidence + screenshots if you want them.

- [ ] **Step 1: Boot dev server**

```bash
npm run dev
```

- [ ] **Step 2: Launch MCP Inspector**

In a second terminal:

```bash
npx @modelcontextprotocol/inspector
```

This opens a UI at http://localhost:6274 (port may vary — check the terminal output).

- [ ] **Step 3: Connect**

In the Inspector UI:
- Transport: **Streamable HTTP**
- URL: `http://localhost:3000/api/mcp/mcp`
- Add header: `Authorization` = `Bearer <your token from .env>`
- Click **Connect**.

Expected: the tool list appears with all 7 tools (`get_group`, `list_expenses`, `get_expense`, `create_expense`, `get_balances`, `settle_up`, `add_member`).

- [ ] **Step 4: Test a read tool**

Pick a real group ULID from your local DB (or create one via the web UI first). Call `get_group` with that `groupId`.

Expected: response shows `{ group: { id, name, currency }, members: [...], currencies: [...] }`.

- [ ] **Step 5: Test a write tool**

Call `create_expense` with the same `groupId`, a real `paidByUserId` from the previous response, `title: "MCP test"`, `amount: 1`, `currency: "SGD"`, no splits override.

Expected: response shows `{ success: true, id: <groupId> }`. Verify the expense appears in the web UI on the Expenses tab.

- [ ] **Step 6: Stop dev server**

Ctrl+C in both terminals.

---

## Task 6: Add a Playwright auth-guard test

**Files:**
- Create: `tests/e2e/mcp-auth.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/mcp-auth.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('MCP auth guard', () => {
    test('rejects missing Authorization header with 401', async ({ request }) => {
        const res = await request.post('/api/mcp/mcp', {
            data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status()).toBe(401)
        expect(await res.text()).toContain('missing Authorization header')
    })

    test('rejects malformed Authorization header with 401', async ({ request }) => {
        const res = await request.post('/api/mcp/mcp', {
            data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            headers: { 'Content-Type': 'application/json', Authorization: 'NotBearer abc' },
        })
        expect(res.status()).toBe(401)
        expect(await res.text()).toContain('malformed Authorization header')
    })

    test('rejects wrong token with 401', async ({ request }) => {
        const res = await request.post('/api/mcp/mcp', {
            data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer thisisnotthetoken',
            },
        })
        expect(res.status()).toBe(401)
        expect(await res.text()).toContain('invalid token')
    })
})
```

- [ ] **Step 2: Run the test**

Make sure the dev server is running (`npm run dev` in another terminal). Then:

```bash
npx playwright test tests/e2e/mcp-auth.spec.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/mcp-auth.spec.ts
git commit -m "test(mcp): cover auth guard rejections with playwright"
```

---

## Task 7: Write the maintenance doc

**Files:**
- Create: `docs/MCP.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write `docs/MCP.md`**

```markdown
# MCP Server

owe-wari ships an MCP (Model Context Protocol) endpoint at `/api/mcp/mcp` that lets AI assistants read groups, log expenses, and settle debts via natural language. Tools are defined in [`src/server/mcp/tools.ts`](../src/server/mcp/tools.ts) and delegate to the existing tRPC server caller — there is no separate business logic.

## When you change the API, check this list

If you add or modify a tRPC procedure under `src/server/api/routers/`, decide whether it should also be exposed via MCP:

- **Mutations** (create/update/delete) — strongly consider adding an MCP tool. Day-to-day "log this expense / settle that debt" is the whole point.
- **Read queries** — add a tool if a user might naturally ask "show me X" through an AI client.
- **Internal-only or admin** — skip.

If you add a tool, add it to `src/server/mcp/tools.ts` and update the table below in this doc.

If you change the **input shape** of an existing procedure (rename a field, add a required field), update the matching tool's Zod schema in `src/server/mcp/tools.ts`. The TypeScript compiler will flag the call site, but the Zod schema and `description` text are not type-checked against the procedure — review them.

## Tool catalog

| Tool | Backed by | Mutation? | Notes |
|---|---|---|---|
| `get_group` | `group.getGroup` + `group.getUsers` + `group.getCurrencies` | no | Single round-trip combining group + members + currencies |
| `list_expenses` | `expense.getExpenses` | no | |
| `get_expense` | `expense.getExpense` | no | Includes per-user split rows |
| `create_expense` | `expense.create` | yes | Tool description tells the AI to confirm with the user first |
| `get_balances` | `expense.getBalances` | no | Per-(user, currency) net balances |
| `settle_up` | `expense.settleUp` | yes | Multi-currency `lines` array |
| `add_member` | `group.addMember` | yes | |

There is intentionally no `list_all_groups` tool. Group ULIDs are 128 bits of entropy and act as the only access control, so MCP clients must already know the group ID (e.g., from a URL the user shared). The AI assistant is expected to remember known group IDs in its own context/memory.

## Auth

All requests require `Authorization: Bearer <MCP_API_TOKEN>`. The token is a single shared secret stored in the `MCP_API_TOKEN` env var (Vercel environment + local `.env`). Generate with:

```bash
openssl rand -hex 32
```

The guard lives in [`src/server/mcp/auth.ts`](../src/server/mcp/auth.ts).

## Confirmation flow for mutations

The MCP protocol supports server-driven elicitation, but owe-wari relies on **conversational confirmation in the AI client** instead. Tool descriptions for `create_expense`, `settle_up`, and `add_member` start with `CONFIRM WITH THE USER before calling.` Well-behaved AI clients (Claude Desktop, Claude Code) read these and ask before invoking.

## Local development

1. Add `MCP_API_TOKEN="..."` to `.env` (generate with `openssl rand -hex 32`).
2. `npm run dev`.
3. `npx @modelcontextprotocol/inspector` to test interactively.

## Connecting from Claude Desktop / Claude Code

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "owe-wari": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://www.owe-wari.com/api/mcp/mcp",
        "--header",
        "Authorization: Bearer YOUR_TOKEN_HERE"
      ]
    }
  }
}
```

**Claude Code** — add a `.mcp.json` in your home directory or project root:

```json
{
  "mcpServers": {
    "owe-wari": {
      "type": "http",
      "url": "https://www.owe-wari.com/api/mcp/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN_HERE" }
    }
  }
}
```

Then restart the client.

## Production deployment

`MCP_API_TOKEN` must be set in the Vercel project's environment variables (Settings → Environment Variables). Set it for **Production**, **Preview**, and **Development** scopes — the env validator in `src/env.js` requires it at build time.
```

- [ ] **Step 2: Add a pointer in `CLAUDE.md`**

Find the `## Architecture` section in `CLAUDE.md` and add a new subsection just before `### Path aliases`:

```markdown
### MCP server
The app exposes an MCP endpoint at `/api/mcp/mcp` for AI clients. When you add or change a tRPC procedure, see [`docs/MCP.md`](docs/MCP.md) — you may need to update the tool catalog in `src/server/mcp/tools.ts` to match.

```

- [ ] **Step 3: Verify the doc renders**

```bash
cat docs/MCP.md | head -40
```

Expected: markdown content prints, no syntax issues.

- [ ] **Step 4: Commit**

```bash
git add docs/MCP.md CLAUDE.md
git commit -m "docs(mcp): add maintenance guide and CLAUDE.md pointer"
```

---

## Task 8: Set up production env var and open PR

**Files:** none — Vercel dashboard + GitHub.

- [ ] **Step 1: Generate a production token**

```bash
openssl rand -hex 32
```

Copy the output.

- [ ] **Step 2: Add to Vercel**

Go to the Vercel project → Settings → Environment Variables. Add:
- Name: `MCP_API_TOKEN`
- Value: (the token from step 1 — different from local `.env`)
- Environments: check Production, Preview, Development

Save.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/mcp-server
gh pr create --title "feat(mcp): add MCP server endpoint with bearer auth" --body "$(cat <<'EOF'
## Summary
- New endpoint at `/api/mcp/mcp` exposes 7 tools (read + mutate) backed by the existing tRPC server caller.
- Bearer-token auth via `MCP_API_TOKEN` env var.
- No `list_all_groups` tool — group access stays gated by 128-bit ULIDs as today.
- Mutation tool descriptions instruct AI clients to confirm with the user before invoking.
- Maintenance guide at [`docs/MCP.md`](docs/MCP.md), referenced from `CLAUDE.md`, so future contributors keep the tool catalog in sync with tRPC.

## Test plan
- [ ] Vercel build passes (env validator finds `MCP_API_TOKEN`)
- [ ] Playwright auth-guard tests pass in CI
- [ ] Manually verified tool list and a `create_expense` call against local dev server using MCP Inspector
- [ ] After deploy, connect Claude Desktop / Claude Code per `docs/MCP.md` and verify a read tool works against prod
- [ ] After deploy, verify a write tool (with confirmation) creates the expected row

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: After PR merges and Vercel deploys**

Hit the prod endpoint to sanity-check:

```bash
curl -i -H "Authorization: Bearer $PROD_TOKEN" -H "Accept: application/json, text/event-stream" -X POST https://www.owe-wari.com/api/mcp/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected: HTTP 200 with a JSON-RPC response listing all 7 tools.

---

## Notes for the implementer

- **`@vercel/mcp-adapter` API may evolve.** This plan was written against the package as of 2026-05. If `createMcpHandler`'s third-arg shape has changed, check the package README; the structure is straightforward.
- **The tool catalog uses Zod schemas as plain object property maps** (`{ groupId: groupIdSchema }`), not full `z.object({...})`. That's the `mcp-adapter`'s expected shape — it builds the JSON Schema for you from those field maps.
- **No retry / circuit breaker / rate limit.** YAGNI. The shared secret is the only access control. If the endpoint becomes a target, add Vercel's edge rate limit.
- **No streaming responses from tools.** Each tool returns a single JSON blob inside an MCP `text` content block. tRPC procedures are all short (sub-second after Task 1's index migration is live), so streaming isn't worth the complexity.
