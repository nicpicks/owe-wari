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
- `group` — `create`, `getGroup`, `getUsers`, `addMember`, `getCurrencies`, `getDefaultPayee`, `updateDefaultPayee`, `updateTripLink`
- `expense` — `create`, `update` (writes an `expense_audits` row when fields change), `delete` (soft delete), `getExpense`, `getExpenses` (filters out deleted), `getTotalExpenseCost`, `getBalances`, `settleUp` (accepts per-currency lines), `getHistory` (unified feed of expense / settlement / edit / delete events), `getCategoryHints` (past title→category pairs for this group, feeding the category suggestion)
- `receipt` — `scan` (Claude Haiku receipt parsing for prefilling expense forms; returns total, line items and a suggested category)

`getBalances` returns one row per `(user, currency)` pair with non-zero balance — netting paid expenses, owed splits, and settlement amounts.

`getHistory` fans out three parallel selects (expenses, settlements, expense_audits) joined to `users` for actor/receiver names, merges in JS, sorts newest-first. No N+1.

### Debt simplification (`src/lib/simplify-debts.ts`)
`simplifyDebts(balances)` runs a greedy min-cash-flow algorithm on the `Balance[]` returned by `getBalances`, reducing N debts to at most N−1 transfers. Used client-side on the balances page.

### Split modes (`src/app/_components/create-expense.tsx`)
The expense form offers four ways to split: **Even**, **Portions** (relative shares — a bigger eater takes 2, someone who skipped takes 0), **%**, and **Manual**. They live in the `SPLIT_MODES` array; each entry supplies a `validate` (gates the submit button) and a `toPayload` (returns `splitUserIds` for the even split, or explicit `splitAmounts`). Adding a mode means adding an array entry plus its row UI — no API change.

Portions and percentages become amounts via `allocateByWeight` (`src/lib/split-allocation.ts`), a largest-remainder allocator working in whole cents, so per-user splits always sum to the expense total exactly.

Line items (from a receipt scan, or started by hand with the "+ Items" button) override the mode toggle: each item is split among the members tapped on its row. They also add themselves up into the hero total, until a total is typed by hand or read off a receipt — after that the total is the user's, and a drifting item sum is only offered ("Items add up to … — use that"), never applied.

### Category suggestions (`src/lib/categorize.ts`)
The create form offers a category for the title being typed, as a tap-to-accept chip under the Category dropdown — it never sets the field itself, and it goes quiet for good once the user picks a category by hand. Three guessers, in priority order:

1. **The receipt scan** — `receipt.scan` already calls Claude to read the image, so the category rides along in the same response at no extra cost or latency.
2. **Group history** — `suggestFromHistory` over `expense.getCategoryHints`. A group's own vocabulary beats any built-in list and needs no English (a past "Konbini" categorised Groceries twice teaches it). Exact title repeats are trusted; looser word-overlap matches need two prior uses and a two-thirds majority.
3. **Built-in rules** — `suggestFromRules`, a phrase table matched on whole words, longest phrase wins (so "grab dinner" is Food while "grab" is Transport).

All three stay silent when unsure: no match, a tie between equally specific rules ("hotel bar"), or a category the group splits on produces no suggestion. That is deliberate — a wrong category is worse than none, because nobody proofreads the dropdown and the error only surfaces later on the totals page. Convenience stores are left out of the rule table for exactly this reason.

### Frontend (`src/app/`)
- Pages are under `src/app/groups/[groupId]/` with tabs: summary, expenses, balances, history, settings
- Shared UI components are in `src/app/_components/`
- Client components use `api` from `~/trpc/react`; server components use the server caller from `~/trpc/server`
- Styling uses Tailwind + DaisyUI with custom CSS variables defined in `src/styles/globals.css` (e.g., `var(--green)`, `var(--red)`, `var(--muted)`, `var(--heading)`, `var(--surface-3)`)

### MCP server
The app exposes an MCP endpoint at `/api/mcp/mcp` for AI clients. When you add or change a tRPC procedure, see [`docs/MCP.md`](docs/MCP.md) — you may need to update the tool catalog in `src/server/mcp/tools.ts` to match.

### Jiogo integration
Groups can link to a [Jiogo](https://jiogo.vercel.app) trip itinerary via `groups.trip_url` (set in group settings, shown as an "Itinerary ↗" link in the group header). `POST /api/integration/group-from-trip` is a public CORS-enabled endpoint that creates a pre-linked group from a trip (Jiogo calls it from its "Create expense group" button). See [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

### Path aliases
`~` maps to `./src` (configured in `tsconfig.json`).
