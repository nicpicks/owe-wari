# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

**owe-wari** is a group expense splitting app (similar to Splitwise). Users create groups, add members, log expenses, and settle debts. There is no authentication — groups are identified by ULID and accessed via URL.

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # ESLint

# Database (project uses Drizzle migrations — prefer generate/migrate over push)
./start-database.sh  # Start local Postgres via Docker (on Windows: run in WSL)
npm run db:generate  # Generate a new migration from schema changes
npm run db:migrate   # Apply pending migrations (idempotent — safe to re-run)
npm run db:studio    # Open Drizzle Studio GUI
npm run db:push      # Push schema directly to DB without a migration (avoid except for quick local hacks)

# Screenshots
npm run screenshot   # Capture app screenshots via Puppeteer
```

## Environment setup

Copy `.env.example` to `.env` and set `POSTGRES_URL`. The default connection string is:
```
POSTGRES_URL="postgresql://postgres:password@localhost:5432/owe-wari"
```

## Architecture

This is a **T3 Stack** app: Next.js App Router + tRPC + Drizzle ORM + PostgreSQL + Tailwind CSS + DaisyUI.

### Data model (`src/server/db/schema.ts`)
All tables are prefixed `owe-wari_` (multi-project schema). Key relationships:
- `groups` → has `currency` (default), has many `group_members` (via `users`), has many `group_currencies` (which currencies the group accepts)
- `expenses` → has its own `currency` (one of the group's enabled currencies), `paidByUserId`, `createdByUserId` (snapshot of paidBy at creation, never updated; used as audit actor), and a nullable `deletedAt` (soft delete). Split via `expense_splits` (one row per user per expense).
- `settlements` → records a payment from `payerId` to `receiverId` in a specific `currency` to clear debt
- `expense_audits` → one row per expense edit, with `actorId` (= the expense's `createdByUserId` at edit time) and `fieldsChanged` (text[])

### tRPC API (`src/server/api/`)
Three routers exposed at `/api/trpc`:
- `group` — `create`, `getGroup`, `getUsers`, `addMember`, `getCurrencies`, `getDefaultPayee`, `updateDefaultPayee`
- `expense` — `create`, `update` (writes an `expense_audits` row when fields change), `delete` (soft delete), `getExpense`, `getExpenses` (filters out deleted), `getTotalExpenseCost`, `getBalances`, `settleUp` (accepts per-currency lines), `getHistory` (unified feed of expense / settlement / edit / delete events)
- `receipt` — `scan` (Gemini-based receipt parsing for prefilling expense forms)

`getBalances` returns one row per `(user, currency)` pair with non-zero balance — netting paid expenses, owed splits, and settlement amounts.

`getHistory` fans out three parallel selects (expenses, settlements, expense_audits) joined to `users` for actor/receiver names, merges in JS, sorts newest-first. No N+1.

### Debt simplification (`src/lib/simplify-debts.ts`)
`simplifyDebts(balances)` runs a greedy min-cash-flow algorithm on the `Balance[]` returned by `getBalances`, reducing N debts to at most N−1 transfers. Used client-side on the balances page.

### Frontend (`src/app/`)
- Pages are under `src/app/groups/[groupId]/` with tabs: summary, expenses, balances, history, settings
- Shared UI components are in `src/app/_components/`
- Client components use `api` from `~/trpc/react`; server components use the server caller from `~/trpc/server`
- Styling uses Tailwind + DaisyUI with custom CSS variables defined in `src/styles/globals.css` (e.g., `var(--green)`, `var(--red)`, `var(--muted)`, `var(--heading)`, `var(--surface-3)`)

### MCP server
The app exposes an MCP endpoint at `/api/mcp/mcp` for AI clients. When you add or change a tRPC procedure, see [`docs/MCP.md`](docs/MCP.md) — you may need to update the tool catalog in `src/server/mcp/tools.ts` to match.

### Path aliases
`~` maps to `./src` (configured in `tsconfig.json`).
