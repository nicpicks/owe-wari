# Multi-Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-currency support to owe-wari. Each expense and settlement is denominated in a specific currency; balances are tracked per-currency; debt simplification runs per-currency; settle-up converts to the group's default currency at confirmation time using editable FX rates.

**Architecture:** Per-currency tracking with no FX rate persistence. Add a `group_currencies` table and `currency` columns to `expenses` and `settlements`. Run `simplifyDebts` once per currency. Store FX rate defaults in a hardcoded frontend constant; rates live only in the settle-up modal's local state.

**Tech Stack:** Next.js 14 App Router, tRPC, Drizzle ORM, PostgreSQL, React, Tailwind + DaisyUI.

**Spec:** [`docs/plans/2026-05-02-multi-currency-design.md`](./2026-05-02-multi-currency-design.md)

---

## File Structure

**Created:**
- `src/lib/currencies.ts` — Currency code constants, symbols, zero-decimal set
- `src/lib/format-currency.ts` — `formatAmount(amount, code)` helper
- `src/lib/fx-rates.ts` — `DEFAULT_RATES` table + `getRate(from, to)` helper
- `src/app/_components/settle-up-modal.tsx` — Multi-currency settle-up modal

**Modified:**
- `src/server/db/schema.ts` — New table + new columns
- `src/server/api/routers/group.ts` — `create` and new `getCurrencies`
- `src/server/api/routers/expense.ts` — `create`, `getExpenses`, `getExpense`, `getTotalExpenseCost`, `getBalances`, `settleUp`
- `src/lib/simplify-debts.ts` — Add `currency` to `Balance` and `Transfer` types
- `src/app/_components/create-group.tsx` — Currency multi-select
- `src/app/_components/create-expense.tsx` — Currency dropdown
- `src/app/groups/[groupId]/expenses/page.tsx` — `formatAmount`
- `src/app/groups/[groupId]/expenses/[expenseId]/expense-detail-modal.tsx` (or wherever it lives) — `formatAmount`
- `src/app/groups/[groupId]/summary/page.tsx` — Per-currency totals/outstanding/balances
- `src/app/groups/[groupId]/balances/page.tsx` — Per-currency sections + new modal
- `src/app/groups/[groupId]/history/page.tsx` — `formatAmount`

**Generated/Refreshed:**
- `screenshots/03-create-group.png`, `04-group-summary.png`, `05-group-expenses.png`, `06-group-balances.png`, `07-group-history.png`, `09-create-expense.png`

---

## Task 1: Currency constants and helpers

**Files:**
- Create: `src/lib/currencies.ts`
- Create: `src/lib/format-currency.ts`
- Create: `src/lib/fx-rates.ts`

- [ ] **Step 1: Create currency constants**

Write `src/lib/currencies.ts`:

```ts
export const SUPPORTED_CURRENCIES = [
    'SGD', 'USD', 'AUD', 'EUR', 'JPY', 'KRW', 'MYR', 'IDR', 'VND',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY: CurrencyCode = 'SGD'

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
    SGD: 'S$',
    USD: 'US$',
    AUD: 'A$',
    EUR: '€',
    JPY: '¥',
    KRW: '₩',
    MYR: 'RM',
    IDR: 'Rp',
    VND: '₫',
}

export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<CurrencyCode> = new Set([
    'JPY', 'KRW', 'VND', 'IDR',
])

export function isSupportedCurrency(code: string): code is CurrencyCode {
    return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
}
```

- [ ] **Step 2: Create format helper**

Write `src/lib/format-currency.ts`:

```ts
import {
    CURRENCY_SYMBOLS,
    ZERO_DECIMAL_CURRENCIES,
    type CurrencyCode,
    isSupportedCurrency,
} from './currencies'

export function formatAmount(amount: number, code: string): string {
    const isZeroDecimal = isSupportedCurrency(code) && ZERO_DECIMAL_CURRENCIES.has(code)
    const decimals = isZeroDecimal ? 0 : 2
    const symbol = isSupportedCurrency(code) ? CURRENCY_SYMBOLS[code as CurrencyCode] : ''
    const abs = Math.abs(amount)
    const formatted = abs.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })
    const sign = amount < 0 ? '-' : ''
    return `${sign}${symbol}${formatted}`
}

export function formatAmountWithCode(amount: number, code: string): string {
    return `${formatAmount(amount, code)} ${code}`
}
```

- [ ] **Step 3: Create FX rate helper**

Write `src/lib/fx-rates.ts`:

```ts
import type { CurrencyCode } from './currencies'

// Approximate rates "1 unit of FROM = N units of TO".
// Hardcoded baseline; settle-up UI lets the user edit before confirming.
const RATES: Partial<Record<CurrencyCode, Partial<Record<CurrencyCode, number>>>> = {
    SGD: { USD: 0.74, AUD: 1.13, EUR: 0.69, JPY: 110, KRW: 1020, MYR: 3.5, IDR: 12000, VND: 18500 },
    USD: { SGD: 1.35 },
    AUD: { SGD: 0.88 },
    EUR: { SGD: 1.45 },
    JPY: { SGD: 0.0091 },
    KRW: { SGD: 0.00098 },
    MYR: { SGD: 0.29 },
    IDR: { SGD: 0.0000833 },
    VND: { SGD: 0.000054 },
}

export function getDefaultRate(from: string, to: string): number {
    if (from === to) return 1
    const direct = RATES[from as CurrencyCode]?.[to as CurrencyCode]
    if (direct != null) return direct
    const inverse = RATES[to as CurrencyCode]?.[from as CurrencyCode]
    if (inverse != null) return 1 / inverse
    return 1
}
```

- [ ] **Step 4: Verify lint passes for new files**

Run: `npm run lint`
Expected: no new errors in `src/lib/currencies.ts`, `src/lib/format-currency.ts`, `src/lib/fx-rates.ts` (existing pre-existing errors elsewhere are fine).

- [ ] **Step 5: Commit**

```bash
git add src/lib/currencies.ts src/lib/format-currency.ts src/lib/fx-rates.ts
git commit -m "feat: add currency constants, formatter, and FX rate defaults"
```

---

## Task 2: Database schema and migration

**Files:**
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Add `groupCurrencies` table to schema**

Open `src/server/db/schema.ts`. Add after the `groupMembers` declaration:

```ts
export const groupCurrencies = createTable('group_currencies', {
    id: serial('id').primaryKey().notNull(),
    groupId: varchar('group_id', { length: 26 })
        .references(() => groups.id)
        .notNull(),
    code: varchar('code', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(
        sql`CURRENT_TIMESTAMP`
    ),
})
```

Add to the `indexes` array at the bottom:

```ts
index('idx_group_currencies_group_id').on(groupCurrencies.groupId),
```

- [ ] **Step 2: Add `currency` column to `expenses`**

In `src/server/db/schema.ts`, modify the `expenses` table — add this field between `amount` and `category`:

```ts
currency: varchar('currency', { length: 3 }).notNull().default('SGD'),
```

The `.default('SGD')` lets `db:push` add the column to existing rows safely. New writes always pass the currency explicitly.

- [ ] **Step 3: Add `currency` column to `settlements`**

In `src/server/db/schema.ts`, modify the `settlements` table — add this field between `amount` and `settledAt`:

```ts
currency: varchar('currency', { length: 3 }).notNull().default('SGD'),
```

- [ ] **Step 4: Push schema changes**

Run: `npm run db:push`
Expected: Drizzle reports `group_currencies` table created and two `currency` columns added with default `'SGD'` filled in.

- [ ] **Step 5: Backfill `group_currencies` from existing groups**

Open Drizzle Studio (`npm run db:studio`) or use any Postgres client to run:

```sql
INSERT INTO "owe-wari_group_currencies" (group_id, code)
SELECT id, currency FROM "owe-wari_groups"
ON CONFLICT DO NOTHING;
```

If you have many existing groups, verify each appears once in `group_currencies`.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add group_currencies table and currency columns"
```

---

## Task 3: `group.getCurrencies` and updated `group.create`

**Files:**
- Modify: `src/server/api/routers/group.ts`

- [ ] **Step 1: Update imports**

In `src/server/api/routers/group.ts`, update the schema import to include `groupCurrencies`:

```ts
import { groups, users, groupMembers, groupCurrencies } from '~/server/db/schema'
```

- [ ] **Step 2: Update `create` mutation**

Replace the existing `create` mutation in `src/server/api/routers/group.ts` with:

```ts
create: publicProcedure
    .input(
        z.object({
            name: z.string().min(1),
            currency: z.string().min(1),
            currencies: z.array(z.string().min(1)).min(1),
            description: z.string(),
            userNames: z.array(z.string().min(1)),
            defaultPayee: z.string(),
        })
    )
    .mutation(async ({ ctx, input }) => {
        try {
            if (!input.currencies.includes(input.currency)) {
                throw new Error('Default currency must be in the currencies list')
            }

            const groupId = ulid()
            const newGroup = await ctx.db
                .insert(groups)
                .values({
                    id: groupId,
                    name: input.name,
                    currency: input.currency,
                    description: input.description,
                })
                .returning({ id: groups.id })

            await ctx.db
                .insert(groupCurrencies)
                .values(input.currencies.map((code) => ({ groupId, code })))

            let defaultPayeeId = ''
            for (const userName of input.userNames) {
                const userId = ulid()
                if (userName === input.defaultPayee) defaultPayeeId = userId
                await ctx.db.insert(users).values({ id: userId, name: userName })
                await ctx.db.insert(groupMembers).values({ groupId, userId })
            }

            if (defaultPayeeId) {
                await ctx.db
                    .update(groups)
                    .set({ defaultPayee: defaultPayeeId })
                    .where(eq(groups.id, groupId))
                    .execute()
            }

            return { success: true, id: newGroup[0]?.id }
        } catch (error) {
            console.error('Error inserting group:', error)
            throw new Error('Failed to create group')
        }
    }),
```

- [ ] **Step 3: Add `getCurrencies` query**

Add this procedure to the router (anywhere after `getGroup`):

```ts
getCurrencies: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
        try {
            const [group] = await ctx.db
                .select({ defaultCode: groups.currency })
                .from(groups)
                .where(eq(groups.id, input.groupId))
                .execute()

            if (!group) return []

            const rows = await ctx.db
                .select({ code: groupCurrencies.code })
                .from(groupCurrencies)
                .where(eq(groupCurrencies.groupId, input.groupId))
                .execute()

            return rows.map(({ code }) => ({
                code,
                isDefault: code === group.defaultCode,
            }))
        } catch (error) {
            console.error('Error fetching currencies:', error)
            throw new Error('Failed to fetch currencies')
        }
    }),
```

- [ ] **Step 4: Verify the dev server compiles**

Run: `npm run dev`
Expected: server starts without TypeScript errors. Hit Ctrl+C after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/group.ts
git commit -m "feat(api): add getCurrencies and accept currencies array on group.create"
```

---

## Task 4: `expense.create` accepts currency

**Files:**
- Modify: `src/server/api/routers/expense.ts`

- [ ] **Step 1: Update imports**

In `src/server/api/routers/expense.ts`, replace the schema import with:

```ts
import {
    expenses,
    expenseSplits,
    groupMembers,
    groupCurrencies,
    settlements,
    users,
} from '~/server/db/schema'
import { and } from 'drizzle-orm'
```

(Add `and` to the existing `drizzle-orm` import if needed.)

- [ ] **Step 2: Add `currency` to `create` input and persist it**

In `src/server/api/routers/expense.ts`, modify the `create` procedure's input schema — add `currency: z.string().min(1)` to the `z.object({...})`:

```ts
create: publicProcedure
    .input(
        z.object({
            groupId: z.string(),
            paidByUserId: z.string(),
            title: z.string().min(1),
            amount: z.number(),
            currency: z.string().min(1),
            category: z.string().optional(),
            notes: z.string().optional(),
            expenseDate: z.date().optional(),
            splitUserIds: z.array(z.string()).optional(),
            splitAmounts: z.array(z.object({
                userId: z.string(),
                amount: z.number().positive(),
            })).optional(),
        })
    )
```

In the same procedure's transaction, before the existing insert, validate the currency against `group_currencies`:

```ts
const allowed = await trx
    .select({ code: groupCurrencies.code })
    .from(groupCurrencies)
    .where(
        and(
            eq(groupCurrencies.groupId, input.groupId),
            eq(groupCurrencies.code, input.currency)
        )
    )
    .execute()
if (allowed.length === 0) {
    throw new Error(`Currency ${input.currency} is not enabled for this group`)
}
```

Then update the `expenses` insert to include `currency: input.currency`:

```ts
const [newExpense] = await trx
    .insert(expenses)
    .values({
        groupId: input.groupId,
        paidByUserId: input.paidByUserId,
        title: input.title,
        amount: input.amount.toString(),
        currency: input.currency,
        category: input.category,
        notes: input.notes,
        expenseDate: input.expenseDate,
    })
    .returning({ id: expenses.id })
    .execute()
```

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/expense.ts
git commit -m "feat(api): accept and validate currency on expense.create"
```

---

## Task 5: Return currency from expense queries

**Files:**
- Modify: `src/server/api/routers/expense.ts`

- [ ] **Step 1: Add `currency` to `getExpenses` projection**

In `src/server/api/routers/expense.ts`, in the `getExpenses` procedure, add `currency: expenses.currency` to the `.select({...})` object:

```ts
.select({
    id: expenses.id,
    title: expenses.title,
    amount: expenses.amount,
    currency: expenses.currency,
    category: expenses.category,
    notes: expenses.notes,
    expenseDate: expenses.expenseDate,
})
```

- [ ] **Step 2: Add `currency` to `getExpense` projection**

In the same file, in the `getExpense` procedure, add `currency: expenses.currency` to its `.select({...})` object alongside `id, title, amount, ...`.

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/expense.ts
git commit -m "feat(api): expose currency in getExpenses and getExpense"
```

---

## Task 6: Per-currency total spent

**Files:**
- Modify: `src/server/api/routers/expense.ts`

- [ ] **Step 1: Update `getTotalExpenseCost` to split by default vs other currencies**

Replace the existing `getTotalExpenseCost` procedure with:

```ts
getTotalExpenseCost: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
        try {
            const [group] = await ctx.db
                .select({ defaultCode: groups.currency })
                .from(groups)
                .where(eq(groups.id, input.groupId))
                .execute()

            if (!group) {
                return { defaultTotal: 0, defaultCurrency: 'SGD', otherCurrencyCount: 0 }
            }

            const [defaultRow] = await ctx.db
                .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
                .from(expenses)
                .where(
                    and(
                        eq(expenses.groupId, input.groupId),
                        eq(expenses.currency, group.defaultCode)
                    )
                )
                .execute()

            const [otherRow] = await ctx.db
                .select({ count: sql<string>`COUNT(*)` })
                .from(expenses)
                .where(
                    and(
                        eq(expenses.groupId, input.groupId),
                        sql`${expenses.currency} <> ${group.defaultCode}`
                    )
                )
                .execute()

            return {
                defaultTotal: parseFloat(defaultRow?.total ?? '0'),
                defaultCurrency: group.defaultCode,
                otherCurrencyCount: parseInt(otherRow?.count ?? '0', 10),
            }
        } catch (error) {
            console.error('Error getting total expense cost:', error)
            throw new Error('Failed to get total expense cost')
        }
    }),
```

You will also need to import `groups` at the top of `expense.ts` if it isn't already. Update the schema import:

```ts
import {
    expenses,
    expenseSplits,
    groupMembers,
    groupCurrencies,
    groups,
    settlements,
    users,
} from '~/server/db/schema'
```

- [ ] **Step 2: Commit**

```bash
git add src/server/api/routers/expense.ts
git commit -m "feat(api): split getTotalExpenseCost by default vs other currencies"
```

---

## Task 7: Per-currency `getBalances`

**Files:**
- Modify: `src/server/api/routers/expense.ts`
- Modify: `src/lib/simplify-debts.ts`

- [ ] **Step 1: Add `currency` to `Balance` and `Transfer` types**

In `src/lib/simplify-debts.ts`, change the interfaces to:

```ts
export interface Balance {
    userId: string
    name: string
    currency: string
    netBalance: number
}

export interface Transfer {
    from: string
    fromName: string
    to: string
    toName: string
    currency: string
    amount: number
}
```

The function body still operates on a single currency at a time — the caller must pre-filter `balances` by currency. Update the `transfers.push` to include `currency`:

```ts
transfers.push({
    from: debtor.userId,
    fromName: debtor.name,
    to: creditor.userId,
    toName: creditor.name,
    currency: balances[0]?.currency ?? '',
    amount,
})
```

(The `balances[0]?.currency` works because callers guarantee uniform currency per call; if the input is empty, `transfers` is also empty, so the empty fallback never matters.)

- [ ] **Step 2: Update `getBalances` to return per-currency rows**

Replace the existing `getBalances` procedure in `src/server/api/routers/expense.ts` with:

```ts
getBalances: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
        try {
            const { groupId } = input

            const members = await ctx.db
                .select({ userId: users.id, name: users.name })
                .from(users)
                .innerJoin(groupMembers, eq(users.id, groupMembers.userId))
                .where(eq(groupMembers.groupId, groupId))
                .execute()

            if (members.length === 0) return []

            const paidRows = await ctx.db
                .select({
                    userId: expenses.paidByUserId,
                    currency: expenses.currency,
                    total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
                })
                .from(expenses)
                .where(eq(expenses.groupId, groupId))
                .groupBy(expenses.paidByUserId, expenses.currency)
                .execute()

            const owedRows = await ctx.db
                .select({
                    userId: expenseSplits.userId,
                    currency: expenses.currency,
                    total: sql<string>`COALESCE(SUM(${expenseSplits.amount}), 0)`,
                })
                .from(expenseSplits)
                .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
                .where(eq(expenses.groupId, groupId))
                .groupBy(expenseSplits.userId, expenses.currency)
                .execute()

            const receivedRows = await ctx.db
                .select({
                    userId: settlements.receiverId,
                    currency: settlements.currency,
                    total: sql<string>`COALESCE(SUM(${settlements.amount}), 0)`,
                })
                .from(settlements)
                .where(eq(settlements.groupId, groupId))
                .groupBy(settlements.receiverId, settlements.currency)
                .execute()

            const settledRows = await ctx.db
                .select({
                    userId: settlements.payerId,
                    currency: settlements.currency,
                    total: sql<string>`COALESCE(SUM(${settlements.amount}), 0)`,
                })
                .from(settlements)
                .where(eq(settlements.groupId, groupId))
                .groupBy(settlements.payerId, settlements.currency)
                .execute()

            // (userId, currency) -> partial sums
            type Key = string
            const k = (userId: string, currency: string): Key => `${userId}|${currency}`
            const acc = new Map<Key, {
                userId: string
                currency: string
                paid: number
                owed: number
                received: number
                settled: number
            }>()
            const ensure = (userId: string, currency: string) => {
                const key = k(userId, currency)
                let row = acc.get(key)
                if (!row) {
                    row = { userId, currency, paid: 0, owed: 0, received: 0, settled: 0 }
                    acc.set(key, row)
                }
                return row
            }

            for (const r of paidRows) ensure(r.userId, r.currency).paid = parseFloat(r.total)
            for (const r of owedRows) ensure(r.userId, r.currency).owed = parseFloat(r.total)
            for (const r of receivedRows) ensure(r.userId, r.currency).received = parseFloat(r.total)
            for (const r of settledRows) ensure(r.userId, r.currency).settled = parseFloat(r.total)

            const memberMap = new Map(members.map((m) => [m.userId, m.name]))

            const out: { userId: string; name: string; currency: string; netBalance: number }[] = []
            for (const row of acc.values()) {
                const name = memberMap.get(row.userId)
                if (!name) continue // user not in group anymore (defensive)
                const netBalance = row.paid - row.owed - row.received + row.settled
                if (Math.abs(netBalance) < 0.005) continue
                out.push({ userId: row.userId, name, currency: row.currency, netBalance })
            }

            return out
        } catch (error) {
            console.error('Error getting balances:', error)
            throw new Error('Failed to get balances')
        }
    }),
```

- [ ] **Step 3: Verify dev server compiles**

Run: `npm run dev`
Expected: server compiles without errors. Hit Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/lib/simplify-debts.ts src/server/api/routers/expense.ts
git commit -m "feat(api): per-currency getBalances and Balance/Transfer types"
```

---

## Task 8: `settleUp` accepts multiple currency lines

**Files:**
- Modify: `src/server/api/routers/expense.ts`

- [ ] **Step 1: Replace `settleUp` mutation**

In `src/server/api/routers/expense.ts`, replace the existing `settleUp` procedure with:

```ts
settleUp: publicProcedure
    .input(
        z.object({
            groupId: z.string(),
            payerId: z.string(),
            receiverId: z.string(),
            lines: z
                .array(
                    z.object({
                        currency: z.string().min(1),
                        amount: z.number().positive(),
                    })
                )
                .min(1),
        })
    )
    .mutation(async ({ ctx, input }) => {
        try {
            await ctx.db.transaction(async (trx) => {
                const allowed = await trx
                    .select({ code: groupCurrencies.code })
                    .from(groupCurrencies)
                    .where(eq(groupCurrencies.groupId, input.groupId))
                    .execute()
                const allowedSet = new Set(allowed.map((r) => r.code))
                for (const line of input.lines) {
                    if (!allowedSet.has(line.currency)) {
                        throw new Error(`Currency ${line.currency} is not enabled for this group`)
                    }
                }

                await trx
                    .insert(settlements)
                    .values(
                        input.lines.map((line) => ({
                            groupId: input.groupId,
                            payerId: input.payerId,
                            receiverId: input.receiverId,
                            amount: line.amount.toString(),
                            currency: line.currency,
                        }))
                    )
                    .execute()
            })
            return { success: true }
        } catch (error) {
            console.error('Error settling up:', error)
            throw new Error('Failed to settle up')
        }
    }),
```

- [ ] **Step 2: Commit**

```bash
git add src/server/api/routers/expense.ts
git commit -m "feat(api): settleUp accepts per-currency lines"
```

---

## Task 9: Group creation UI — currency multi-select

**Files:**
- Modify: `src/app/_components/create-group.tsx`

- [ ] **Step 1: Add imports and replace currency state**

In `src/app/_components/create-group.tsx`, add at the top with the other imports:

```ts
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '~/lib/currencies'
```

Replace the existing `const [currency, setCurrency] = useState('SGD')` line with:

```ts
const [currencies, setCurrencies] = useState<string[]>([DEFAULT_CURRENCY])
```

- [ ] **Step 2: Update submit handler**

Replace the body of `handleSubmit` with:

```ts
const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const validMembers = members.filter((m) => m.trim().length > 0)
    createGroup.mutate({
        name,
        currency: DEFAULT_CURRENCY,
        currencies,
        description,
        userNames: validMembers,
        defaultPayee,
    })
}
```

- [ ] **Step 3: Replace currency `<select>` with checkbox grid**

In the same file, locate the JSX block for the Currency field — it currently looks like:

```tsx
<div className="field-group">
    <label className="field-label">Currency</label>
    <select
        className="field-select"
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
    >
        {['SGD', 'USD', 'AUD', 'EUR', 'JPY', 'KRW', 'MYR', 'IDR', 'VND'].map((c) => (
            <option key={c} value={c}>{c}</option>
        ))}
    </select>
</div>
```

Replace it with:

```tsx
<div className="field-group" style={{ gridColumn: '1 / -1' }}>
    <label className="field-label">Currencies</label>
    <div
        style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
        }}
    >
        {SUPPORTED_CURRENCIES.map((c) => {
            const isDefault = c === DEFAULT_CURRENCY
            const checked = currencies.includes(c)
            return (
                <label
                    key={c}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.625rem',
                        border: `1px solid ${checked ? 'var(--amber)' : 'var(--border)'}`,
                        borderRadius: '6px',
                        background: checked ? 'var(--amber-dim)' : 'var(--surface-2)',
                        cursor: isDefault ? 'not-allowed' : 'pointer',
                        opacity: isDefault ? 0.85 : 1,
                        fontSize: '0.8125rem',
                        color: 'var(--body)',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={checked}
                        disabled={isDefault}
                        onChange={(e) => {
                            if (isDefault) return
                            setCurrencies((prev) =>
                                e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)
                            )
                        }}
                        style={{ accentColor: 'var(--amber)' }}
                    />
                    <span style={{ fontWeight: 600 }}>{c}</span>
                    {isDefault && (
                        <span style={{ color: 'var(--muted)', fontSize: '0.6875rem' }}>(default)</span>
                    )}
                </label>
            )
        })}
    </div>
</div>
```

Remove the `gridTemplateColumns: '1fr 1fr'` two-column layout in the parent wrapper if it conflicts; keep description as its own field below.

- [ ] **Step 4: Test in browser**

Run: `npm run dev`
Open the create-group page. Verify:
- SGD checkbox is checked, disabled, shows "(default)"
- Other currency checkboxes toggle freely
- Submitting creates a group; check the DB (`db:studio`) — `group_currencies` has rows for the chosen codes; `groups.currency = 'SGD'`.

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/create-group.tsx
git commit -m "feat(ui): currency multi-select on group creation"
```

---

## Task 10: Expense creation UI — currency dropdown

**Files:**
- Modify: `src/app/_components/create-expense.tsx`

- [ ] **Step 1: Fetch group currencies and add state**

In `src/app/_components/create-expense.tsx`, near the other `useQuery` calls, add:

```ts
const { data: groupCurrenciesData } = api.group.getCurrencies.useQuery(
    { groupId: groupId ?? '' },
    { enabled: !!groupId }
)
const [currency, setCurrency] = useState<string>('SGD')

useEffect(() => {
    if (!groupCurrenciesData) return
    const def = groupCurrenciesData.find((c) => c.isDefault)?.code
    if (def) setCurrency(def)
}, [groupCurrenciesData])
```

(Make sure `useEffect` is imported alongside `useState` from React — it already is in this file.)

- [ ] **Step 2: Pass currency to the create mutation**

In the same file, locate the `createExpense.mutate({...})` call. Add `currency` to the payload:

```ts
createExpense.mutate({
    groupId,
    paidByUserId,
    title,
    amount,
    currency,
    // ... rest unchanged
})
```

- [ ] **Step 3: Add currency dropdown next to the amount field**

Find the JSX where the `amount` input is rendered. Wrap it (and the new currency select) in a flex row:

```tsx
<div className="field-group" style={{ flex: 1 }}>
    <label className="field-label">Amount</label>
    <input
        className="field-input"
        type="number"
        step="0.01"
        value={amount || ''}
        onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
    />
</div>
<div className="field-group" style={{ width: '110px' }}>
    <label className="field-label">Currency</label>
    <select
        className="field-select"
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
    >
        {(groupCurrenciesData ?? []).map(({ code }) => (
            <option key={code} value={code}>{code}</option>
        ))}
    </select>
</div>
```

The exact wrapping depends on the existing layout. Aim for: amount input takes most of the width, currency select sits to its right at fixed width, both share one row.

- [ ] **Step 4: Test in browser**

Run: `npm run dev`
Open a group's expense creation page. Verify:
- Currency dropdown shows only the currencies enabled for the group
- Default currency is preselected
- Submitting saves the expense with the chosen currency (verify via `db:studio` — `expenses.currency` matches selection)

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/create-expense.tsx
git commit -m "feat(ui): currency dropdown on expense creation"
```

---

## Task 11: Expense list and detail formatting

**Files:**
- Modify: `src/app/groups/[groupId]/expenses/page.tsx`
- Modify: any expense detail modal (search for it next)

- [ ] **Step 1: Locate expense detail modal**

Run: `find src/app -iname "*expense-detail*"` or:

```bash
grep -r "ExpenseDetailModal" src/app -l
```

Note the file path(s) for use below.

- [ ] **Step 2: Update expenses page to format with currency**

In `src/app/groups/[groupId]/expenses/page.tsx`:

1. Add `import { formatAmount } from '~/lib/format-currency'` at the top.
2. Find every place that renders an expense's amount. Each currently looks like `$${expense.amount}` or `expense.amount.toFixed(2)`. Replace with `formatAmount(parseFloat(expense.amount), expense.currency)` (or `expense.amount` if it's already a number).

The exact substitution depends on what the file currently does. Apply formatAmount everywhere an expense amount renders.

- [ ] **Step 3: Update expense detail modal**

In the expense detail modal file:

1. Add `import { formatAmount } from '~/lib/format-currency'`.
2. Replace the header amount and any split row amounts with `formatAmount(parseFloat(amount), currency)`.
3. Note: the `splits` array doesn't contain currency directly — splits are always in the parent expense's currency. Pass the parent's `currency` from the modal-level data into each split row formatter.

- [ ] **Step 4: Update history page**

In `src/app/groups/[groupId]/history/page.tsx`:

1. Add `import { formatAmount } from '~/lib/format-currency'`.
2. For every expense or settlement amount rendered, format with the row's currency.
3. The history page query likely returns rows from both `expenses` and `settlements`. If it doesn't currently include `currency`, update the query (in `expense.ts` or wherever it lives) to project `currency`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`
Open a group with mixed-currency expenses. Verify each expense in the list, in the detail modal, and in history shows the correct symbol and decimals (e.g., `¥3,000` with no decimals, `S$50.00` with two).

- [ ] **Step 6: Commit**

```bash
git add src/app/groups/\[groupId\]/expenses/page.tsx \
        src/app/groups/\[groupId\]/history/page.tsx \
        # plus the modal file you found above
git commit -m "feat(ui): format expense and settlement amounts with currency"
```

---

## Task 12: Summary page — per-currency totals and balances

**Files:**
- Modify: `src/app/groups/[groupId]/summary/page.tsx`

- [ ] **Step 1: Update query consumption for total spent**

In `src/app/groups/[groupId]/summary/page.tsx`, the `getTotalExpenseCost` query now returns `{ defaultTotal, defaultCurrency, otherCurrencyCount }` (an object, not a number). Update the destructuring:

```ts
const { data: totals } = api.expense.getTotalExpenseCost.useQuery(
    { groupId },
    { enabled: !!groupId }
)
```

Then in the "Total spent" card JSX, replace the existing amount-rendering block with:

```tsx
<div className="card-dark" style={{ padding: '1.25rem' }}>
    <div className="section-sub" style={{ marginBottom: '0.5rem' }}>Total spent</div>
    <div
        style={{
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: '2rem',
            fontWeight: 600,
            color: 'var(--heading)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
        }}
    >
        {totals
            ? formatAmount(totals.defaultTotal, totals.defaultCurrency)
            : '—'}
    </div>
    {totals && totals.otherCurrencyCount > 0 && (
        <div style={{ marginTop: '0.375rem', fontSize: '0.6875rem', color: 'var(--muted)' }}>
            + {totals.otherCurrencyCount} expense
            {totals.otherCurrencyCount !== 1 ? 's' : ''} in other currencies
        </div>
    )}
</div>
```

Add at the top of the file: `import { formatAmount } from '~/lib/format-currency'`.

- [ ] **Step 2: Update the `Outstanding` card to filter by default currency**

`getBalances` now returns per-currency rows. Update the `totalOwed` computation:

```ts
const defaultCurrency = totals?.defaultCurrency ?? 'SGD'
const totalOwedDefault = balances
    ? balances
          .filter((b) => b.currency === defaultCurrency && b.netBalance < -0.005)
          .reduce((s, b) => s + Math.abs(b.netBalance), 0)
    : null
const otherCurrenciesOutstanding = balances
    ? new Set(
          balances
              .filter((b) => b.currency !== defaultCurrency && b.netBalance < -0.005)
              .map((b) => b.currency)
      ).size
    : 0
```

In the Outstanding card JSX, render `formatAmount(totalOwedDefault ?? 0, defaultCurrency)` and below it (when `otherCurrenciesOutstanding > 0`) a small `+ N other currencies outstanding` hint, mirroring the Total spent card's secondary line.

- [ ] **Step 3: Update Member Balances list**

The current list maps `balances.map(({ userId, name, netBalance }, i) => ...)`. Group by `userId` first, since each user can now have multiple rows:

```ts
const balancesByUser = new Map<string, { name: string; rows: { currency: string; netBalance: number }[] }>()
for (const b of balances ?? []) {
    let entry = balancesByUser.get(b.userId)
    if (!entry) {
        entry = { name: b.name, rows: [] }
        balancesByUser.set(b.userId, entry)
    }
    entry.rows.push({ currency: b.currency, netBalance: b.netBalance })
}

// Also include members with zero balance — fetch via api.group.getUsers
const { data: usersData } = api.group.getUsers.useQuery(
    { groupId },
    { enabled: !!groupId }
)
```

Then render: one block per member, with one sub-line per currency they have a non-zero balance in. Members in `usersData` not in `balancesByUser` show as "settled".

```tsx
{usersData?.map((u, i) => {
    const entry = balancesByUser.get(u.id)
    return (
        <div key={u.id} className={`ledger-row anim-fade-up d-${Math.min(i + 2, 8)}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                {/* avatar circle — keep existing markup */}
                <span style={{ color: 'var(--body)', fontSize: '0.9375rem' }}>{u.name}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
                {!entry || entry.rows.length === 0 ? (
                    <span className="font-mono amount-neu" style={{ fontSize: '0.9375rem' }}>settled</span>
                ) : (
                    entry.rows.map(({ currency, netBalance }) => (
                        <span
                            key={currency}
                            className={`font-mono ${netBalance > 0 ? 'amount-pos' : 'amount-neg'}`}
                            style={{ fontSize: '0.9375rem' }}
                        >
                            {netBalance > 0 ? '+' : '–'}
                            {formatAmount(Math.abs(netBalance), currency)}
                        </span>
                    ))
                )}
            </div>
        </div>
    )
})}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Open a group's summary page with multi-currency expenses. Verify:
- Total spent shows default-currency total + "+ N expenses in other currencies"
- Outstanding shows default-currency total + other currencies hint
- Each member row shows per-currency balances stacked

- [ ] **Step 5: Commit**

```bash
git add src/app/groups/\[groupId\]/summary/page.tsx
git commit -m "feat(ui): per-currency totals and member balances on summary"
```

---

## Task 13: Settle-up modal

**Files:**
- Create: `src/app/_components/settle-up-modal.tsx`

- [ ] **Step 1: Create the modal component**

Write `src/app/_components/settle-up-modal.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatAmount } from '~/lib/format-currency'
import { getDefaultRate } from '~/lib/fx-rates'

interface SettleLine {
    currency: string
    amount: number
}

interface Props {
    open: boolean
    fromName: string
    toName: string
    defaultCurrency: string
    lines: SettleLine[]
    onClose: () => void
    onConfirm: (lines: SettleLine[]) => void
    isSubmitting: boolean
}

export default function SettleUpModal({
    open,
    fromName,
    toName,
    defaultCurrency,
    lines,
    onClose,
    onConfirm,
    isSubmitting,
}: Props) {
    // rates[code] = "1 unit of `code` in defaultCurrency"
    const [rates, setRates] = useState<Record<string, number>>({})

    useEffect(() => {
        const next: Record<string, number> = {}
        for (const line of lines) {
            if (line.currency === defaultCurrency) continue
            next[line.currency] = getDefaultRate(line.currency, defaultCurrency)
        }
        setRates(next)
    }, [lines, defaultCurrency])

    const total = useMemo(() => {
        let sum = 0
        for (const line of lines) {
            if (line.currency === defaultCurrency) sum += line.amount
            else sum += line.amount * (rates[line.currency] ?? 1)
        }
        return sum
    }, [lines, rates, defaultCurrency])

    if (!open) return null

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                padding: '1rem',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="card-dark"
                style={{ width: '100%', maxWidth: '420px', padding: '1.5rem' }}
            >
                <div className="section-title" style={{ marginBottom: '0.25rem' }}>
                    Settle with {toName}
                </div>
                <div className="section-sub" style={{ marginBottom: '1.25rem' }}>
                    {fromName} pays {toName}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {lines.map((line) => {
                        const isDefault = line.currency === defaultCurrency
                        const rate = rates[line.currency] ?? 1
                        const converted = line.amount * rate
                        return (
                            <div
                                key={line.currency}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.375rem',
                                    padding: '0.75rem',
                                    background: 'var(--surface-2)',
                                    borderRadius: '6px',
                                }}
                            >
                                <div className="font-mono" style={{ fontSize: '0.9375rem', color: 'var(--heading)' }}>
                                    {formatAmount(line.amount, line.currency)} {line.currency}
                                </div>
                                {!isDefault && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                        <span>×</span>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={rate}
                                            onChange={(e) =>
                                                setRates((prev) => ({
                                                    ...prev,
                                                    [line.currency]: parseFloat(e.target.value) || 0,
                                                }))
                                            }
                                            style={{
                                                width: '90px',
                                                padding: '0.125rem 0.375rem',
                                                background: 'var(--surface-3)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '4px',
                                                color: 'var(--body)',
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '0.75rem',
                                            }}
                                        />
                                        <span>= {formatAmount(converted, defaultCurrency)} {defaultCurrency}</span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div
                    style={{
                        marginTop: '1.25rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                    }}
                >
                    <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>Total to pay</span>
                    <span className="font-mono" style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--amber)' }}>
                        {formatAmount(total, defaultCurrency)} {defaultCurrency}
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                    <button type="button" className="btn-ghost" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-amber"
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={isSubmitting}
                        onClick={() => onConfirm(lines)}
                    >
                        {isSubmitting ? 'Settling…' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: no new errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/settle-up-modal.tsx
git commit -m "feat(ui): add multi-currency settle-up modal"
```

---

## Task 14: Balances page — per-currency sections + modal wiring

**Files:**
- Modify: `src/app/groups/[groupId]/balances/page.tsx`

- [ ] **Step 1: Replace the balances + transfers logic**

Open `src/app/groups/[groupId]/balances/page.tsx`. Replace its body with the following structure (preserving the existing `'use client'`, imports, and Tabs scaffolding):

```tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import Tabs from '~/app/_components/tabs'
import SettleUpModal from '~/app/_components/settle-up-modal'
import { api } from '~/trpc/react'
import { simplifyDebts, type Transfer } from '~/lib/simplify-debts'
import { formatAmount } from '~/lib/format-currency'

interface PendingSettle {
    fromUserId: string
    fromName: string
    toUserId: string
    toName: string
    lines: { currency: string; amount: number }[]
}

const BalancesTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => router.push(`/groups/${groupId}/${tab}`)

    const utils = api.useUtils()

    const { data: balances, isLoading } = api.expense.getBalances.useQuery(
        { groupId },
        { enabled: !!groupId }
    )
    const { data: group } = api.group.getGroup.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const defaultCurrency = group?.currency ?? 'SGD'

    const settleUp = api.expense.settleUp.useMutation({
        onSuccess: async () => {
            await utils.expense.getBalances.invalidate({ groupId })
            setPending(null)
        },
        onError: (error) => {
            console.error('Error settling up:', error)
            alert('Failed to settle up')
            setPending(null)
        },
    })

    const [pending, setPending] = useState<PendingSettle | null>(null)

    // Group transfers by currency, then by (from, to) pair across currencies.
    const { transfersByCurrency, transfersByPair } = useMemo(() => {
        const byCurrency = new Map<string, Transfer[]>()
        const byPair = new Map<string, Transfer[]>()
        if (!balances) return { transfersByCurrency: byCurrency, transfersByPair: byPair }

        const currencies = Array.from(new Set(balances.map((b) => b.currency)))
        for (const code of currencies) {
            const subset = balances.filter((b) => b.currency === code)
            const transfers = simplifyDebts(subset)
            byCurrency.set(code, transfers)
            for (const t of transfers) {
                const key = `${t.from}|${t.to}`
                const arr = byPair.get(key) ?? []
                arr.push(t)
                byPair.set(key, arr)
            }
        }
        return { transfersByCurrency: byCurrency, transfersByPair: byPair }
    }, [balances])

    const allTransferKeys = Array.from(transfersByPair.keys())

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>

                {/* Per-currency balances */}
                <div className="card-dark anim-fade-up d-0" style={{ marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Balances</div>
                        <div className="section-sub">Net position — positive means you're owed</div>
                    </div>

                    {isLoading && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem 0' }}>Loading…</p>
                    )}

                    {Array.from(transfersByCurrency.entries()).length === 0 && !isLoading && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Everyone is all square</p>
                    )}

                    {Array.from(transfersByCurrency.entries()).map(([code, transfers]) => (
                        <div key={code} style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                {code}
                            </div>
                            {transfers.length === 0 && (
                                <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Settled</p>
                            )}
                            {transfers.map((t) => (
                                <div key={`${t.from}-${t.to}-${code}`} className="ledger-row">
                                    <div style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--body)' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{t.fromName}</span>
                                        <span style={{ color: 'var(--muted)', margin: '0 0.375rem' }}>→</span>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{t.toName}</span>
                                    </div>
                                    <span className="font-mono" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)' }}>
                                        {formatAmount(t.amount, code)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Settle up — one button per (from, to) pair */}
                <div className="card-dark anim-fade-up d-2">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Settle up</div>
                        <div className="section-sub">
                            {allTransferKeys.length === 0
                                ? 'No outstanding debts'
                                : `${allTransferKeys.length} pair${allTransferKeys.length !== 1 ? 's' : ''} to settle`}
                        </div>
                    </div>

                    {allTransferKeys.map((key) => {
                        const transfers = transfersByPair.get(key)!
                        const first = transfers[0]!
                        const lines = transfers.map((t) => ({ currency: t.currency, amount: t.amount }))
                        return (
                            <div key={key} className="ledger-row">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.9375rem', color: 'var(--body)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{first.fromName}</span>
                                        <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>→</span>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{first.toName}</span>
                                    </div>
                                    <div className="font-mono" style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                                        {transfers.map((t) => formatAmount(t.amount, t.currency)).join(' + ')}
                                    </div>
                                </div>
                                <button
                                    className="btn-sm-settle"
                                    onClick={() =>
                                        setPending({
                                            fromUserId: first.from,
                                            fromName: first.fromName,
                                            toUserId: first.to,
                                            toName: first.toName,
                                            lines,
                                        })
                                    }
                                >
                                    Settle
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            <SettleUpModal
                open={!!pending}
                fromName={pending?.fromName ?? ''}
                toName={pending?.toName ?? ''}
                defaultCurrency={defaultCurrency}
                lines={pending?.lines ?? []}
                onClose={() => setPending(null)}
                isSubmitting={settleUp.isPending}
                onConfirm={(lines) => {
                    if (!pending) return
                    settleUp.mutate({
                        groupId,
                        payerId: pending.fromUserId,
                        receiverId: pending.toUserId,
                        lines,
                    })
                }}
            />
        </div>
    )
}

export default BalancesTab
```

- [ ] **Step 2: Manual verification — single currency**

Run: `npm run dev`. Open a single-currency group's balances page. Verify:
- Balances render under their currency heading
- Clicking Settle opens the modal showing only that one line, no rate UI
- Confirming records the settlement and the pair disappears from the list

- [ ] **Step 3: Manual verification — multi currency**

Open a multi-currency group where one pair owes in two currencies. Verify:
- Two currency sections in Balances, each with simplified transfers
- The pair appears in the Settle up list with both amounts shown (`S$50.00 + ¥3,000`)
- Clicking Settle opens the modal with both rows
- The non-default-currency row has an editable rate; total updates live
- Confirming creates two settlement rows; both balances clear

- [ ] **Step 4: Commit**

```bash
git add src/app/groups/\[groupId\]/balances/page.tsx
git commit -m "feat(ui): per-currency balances and multi-currency settle-up"
```

---

## Task 15: Regenerate screenshots

**Files:**
- Update: `screenshots/03-create-group.png`, `04-group-summary.png`, `05-group-expenses.png`, `06-group-balances.png`, `07-group-history.png`, `09-create-expense.png`

- [ ] **Step 1: Seed a multi-currency demo group**

Use the dev app to create a group named "Tokyo trip" with SGD + JPY enabled, three members (Alice, Bob, Diana), and a couple of expenses in each currency. Trigger one settlement so history has a non-empty row in a non-default currency.

- [ ] **Step 2: Run the screenshot script**

Run: `npm run screenshot`
Expected: regenerates all PNGs in `screenshots/`. Confirm the six listed files visually reflect multi-currency content.

- [ ] **Step 3: Confirm visually**

Open each of the six screenshots. They must show:
- `03-create-group.png` — checkbox grid with SGD locked
- `04-group-summary.png` — totals card with default + "+ N other currencies" hint
- `05-group-expenses.png` — rows with mixed currency labels
- `06-group-balances.png` — per-currency sections + simplified transfers
- `07-group-history.png` — settlement and expense rows with currency labels
- `09-create-expense.png` — currency dropdown next to amount

If any screenshot doesn't reflect multi-currency content, edit the seed data and re-run the screenshot script.

- [ ] **Step 4: Commit**

```bash
git add screenshots/03-create-group.png \
        screenshots/04-group-summary.png \
        screenshots/05-group-expenses.png \
        screenshots/06-group-balances.png \
        screenshots/07-group-history.png \
        screenshots/09-create-expense.png
git commit -m "docs: regenerate screenshots for multi-currency"
```

---

## Final verification

- [ ] **Lint clean for all changed files**

Run: `npm run lint`
Expected: no new errors introduced by this branch in any of the files listed in the File Structure section. (Pre-existing errors elsewhere are out of scope.)

- [ ] **End-to-end smoke**

In the dev app:
1. Create a fresh group with SGD + JPY enabled.
2. Add an SGD expense and a JPY expense.
3. Confirm summary, expenses, history, and balances pages all render correct currencies.
4. Settle up — confirm the modal flow, rate editing, and that both balances zero out.
5. Reload — confirm everything persists across page loads.

- [ ] **Push the branch**

Run: `git push`
Expected: branch updates on remote with all multi-currency commits.
