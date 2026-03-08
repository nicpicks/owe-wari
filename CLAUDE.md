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

# Database
./start-database.sh  # Start local Postgres via Docker (on Windows: run in WSL)
npm run db:push      # Push schema changes directly to DB (dev)
npm run db:generate  # Generate migration files
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio GUI

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
- `groups` → has many `group_members` (via `users`)
- `expenses` → paid by one user, split via `expense_splits` (one row per user per expense)
- `settlements` → records a payment from `payerId` to `receiverId` to track debt repayment

### tRPC API (`src/server/api/`)
Two routers exposed at `/api/trpc`:
- `group` — create group, getUsers, getDefaultPayee, updateDefaultPayee
- `expense` — create expense, getExpenses, getTotalExpenseCost, getBalances, settleUp

`getBalances` computes net balances by summing paid expenses, owed splits, and settlement amounts per user.

### Debt simplification (`src/lib/simplify-debts.ts`)
`simplifyDebts(balances)` runs a greedy min-cash-flow algorithm on the `Balance[]` returned by `getBalances`, reducing N debts to at most N−1 transfers. Used client-side on the balances page.

### Frontend (`src/app/`)
- Pages are under `src/app/groups/[groupId]/` with tabs: summary, expenses, balances, history, settings
- Shared UI components are in `src/app/_components/`
- Client components use `api` from `~/trpc/react`; server components use the server caller from `~/trpc/server`
- Styling uses Tailwind + DaisyUI with custom CSS variables defined in `src/styles/globals.css` (e.g., `var(--green)`, `var(--red)`, `var(--muted)`, `var(--heading)`, `var(--surface-3)`)

### Path aliases
`~` maps to `./src` (configured in `tsconfig.json`).
