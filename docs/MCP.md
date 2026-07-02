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
| `get_group` | `group.getGroup` + `group.getUsers` + `group.getCurrencies` | no | Single round-trip combining group + members + currencies. Includes `tripUrl` (linked Jiogo itinerary) when set |
| `list_expenses` | `expense.getExpenses` | no | |
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

## Quick smoke test with curl

POST requests to the streamable-HTTP endpoint require both `Authorization` and `Content-Type: application/json` headers (the v1 adapter rejects POSTs without the latter). Initialize handshake:

```bash
TOKEN=$(grep MCP_API_TOKEN .env | cut -d= -f2 | tr -d '"')
curl -i -X POST http://localhost:3000/api/mcp/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

A 200 with a `serverInfo` block confirms auth + adapter wiring.

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

## Known limitations

- **No `get_expense` tool.** The underlying `expense.getExpense` tRPC procedure looks up expenses by numeric ID without a group scope, which would let a token holder enumerate expenses across groups. Once the procedure is updated to require and validate `groupId`, the tool can be re-added. Use `list_expenses(groupId)` to enumerate expenses within a known group.
