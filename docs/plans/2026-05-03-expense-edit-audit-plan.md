# Expense Edit Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface expense edits on the History page as a third event variant. Each edit is attributed to the expense's original payer (snapshotted at creation time) and lists which field names changed.

**Architecture:** Add `expenses.createdByUserId` (immutable snapshot of `paidByUserId` at creation). Add a new `expense_audits` table (one row per edit, recording changed field names and the actor). The `expense.update` mutation does a server-side diff and inserts an audit row when fields actually changed. `expense.getHistory` adds a third parallel select for audit rows; the History page renders them with a `✏` icon and humanized field-name list.

**Tech Stack:** Next.js 14 App Router, tRPC, Drizzle ORM, PostgreSQL, React, Tailwind + DaisyUI.

**Spec:** [`docs/plans/2026-05-03-expense-edit-audit-design.md`](./2026-05-03-expense-edit-audit-design.md)

---

## File Structure

**Created:**
- `drizzle/0006_expense_edit_audit.sql` — generated then hand-edited migration

**Modified:**
- `src/server/db/schema.ts` — add `expenses.createdByUserId`, add `expenseAudits` table
- `src/server/api/routers/expense.ts` — `create` (set createdByUserId), `update` (diff + audit insert), `getHistory` (third source)
- `src/app/groups/[groupId]/history/page.tsx` — render edit event rows
- `scripts/screenshot.mjs` — edit one seeded expense so the screenshot demos the new event

**Refreshed:**
- `screenshots/07-group-history.png`

---

## Task 1: Schema and migration

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/0006_expense_edit_audit.sql` (auto-generated, then hand-edited)

- [ ] **Step 1: Add `createdByUserId` to the `expenses` table**

In `src/server/db/schema.ts`, modify the `expenses` table — add this field directly under `paidByUserId`:

```ts
createdByUserId: varchar('created_by_user_id', { length: 26 })
    .references(() => users.id)
    .notNull(),
```

Final shape of the `expenses` columns block (relevant section):

```ts
expenses: createTable(
    'expenses',
    {
        id: serial('id').primaryKey().notNull(),
        groupId: varchar('group_id', { length: 26 })
            .references(() => groups.id)
            .notNull(),
        paidByUserId: varchar('paid_by_user_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        createdByUserId: varchar('created_by_user_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        title: varchar('title', { length: 256 }).notNull(),
        // ... rest unchanged
    },
    // index callback unchanged
)
```

- [ ] **Step 2: Add `expenseAudits` table to schema**

In `src/server/db/schema.ts`, append this table definition after the `settlements` table:

```ts
export const expenseAudits = createTable(
    'expense_audits',
    {
        id: serial('id').primaryKey().notNull(),
        expenseId: integer('expense_id').references(() => expenses.id).notNull(),
        groupId: varchar('group_id', { length: 26 })
            .references(() => groups.id)
            .notNull(),
        actorId: varchar('actor_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        fieldsChanged: text('fields_changed').array().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (t) => ({
        groupIdIdx: index('idx_expense_audits_group_id').on(t.groupId),
        expenseIdIdx: index('idx_expense_audits_expense_id').on(t.expenseId),
    })
)
```

Add `text` to the existing `drizzle-orm/pg-core` import at the top of the file:

```ts
import {
    index,
    integer,
    numeric,
    pgTableCreator,
    serial,
    text,
    timestamp,
    varchar,
} from 'drizzle-orm/pg-core'
```

- [ ] **Step 3: Generate the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0006_*.sql` is created. Rename it (or note its name) — for the rest of this task we'll call it `drizzle/0006_expense_edit_audit.sql`. If Drizzle picks a different suffix, use whatever name it generated.

Inspect the file. It will likely contain:
- `ALTER TABLE "owe-wari_expenses" ADD COLUMN "created_by_user_id" varchar(26) NOT NULL REFERENCES "owe-wari_users"("id");` — this WILL FAIL on existing rows.
- `CREATE TABLE "owe-wari_expense_audits" ( ... );`
- A couple of `CREATE INDEX` statements.

- [ ] **Step 4: Hand-edit the migration to support backfill**

Open `drizzle/0006_expense_edit_audit.sql` and replace the `ADD COLUMN ... NOT NULL` line with the following three statements (preserve the rest of the file as generated). The full file should look like this — adapt to whatever Drizzle generated for the table-create + index lines:

```sql
ALTER TABLE "owe-wari_expenses" ADD COLUMN IF NOT EXISTS "created_by_user_id" varchar(26) REFERENCES "owe-wari_users"("id");
--> statement-breakpoint
UPDATE "owe-wari_expenses" SET "created_by_user_id" = "paid_by_user_id" WHERE "created_by_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "owe-wari_expenses" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_expense_audits" (
    "id" serial PRIMARY KEY NOT NULL,
    "expense_id" integer NOT NULL,
    "group_id" varchar(26) NOT NULL,
    "actor_id" varchar(26) NOT NULL,
    "fields_changed" text[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "owe-wari_expense_audits_expense_id_owe-wari_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "owe-wari_expenses"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "owe-wari_expense_audits_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "owe-wari_groups"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "owe-wari_expense_audits_actor_id_owe-wari_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "owe-wari_users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expense_audits_group_id" ON "owe-wari_expense_audits" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expense_audits_expense_id" ON "owe-wari_expense_audits" USING btree ("expense_id");
```

Key edit: the `created_by_user_id` column is added **without** `NOT NULL` first, then a backfill `UPDATE` populates it from `paid_by_user_id`, then `ALTER COLUMN ... SET NOT NULL` enforces the constraint. This sequence is the standard pattern for adding a NOT NULL column to a populated table.

- [ ] **Step 5: Apply the migration locally**

Run: `npm run db:migrate`
Expected: `0006_expense_edit_audit.sql` applied. No errors. Use `npm run db:studio` to verify:
- `owe-wari_expenses` has a `created_by_user_id` column matching `paid_by_user_id` for every row.
- `owe-wari_expense_audits` table exists and is empty.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema.ts drizzle/0006_expense_edit_audit.sql drizzle/meta/_journal.json drizzle/meta/0006_snapshot.json
git commit -m "feat(db): add createdByUserId snapshot and expense_audits table"
```

---

## Task 2: `expense.create` snapshots `createdByUserId`

**Files:**
- Modify: `src/server/api/routers/expense.ts`

- [ ] **Step 1: Set `createdByUserId` on insert**

Open `src/server/api/routers/expense.ts`. Find the `create` mutation. Inside the transaction, the insert into `expenses` currently looks like:

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

Add `createdByUserId: input.paidByUserId,` after `paidByUserId`:

```ts
const [newExpense] = await trx
    .insert(expenses)
    .values({
        groupId: input.groupId,
        paidByUserId: input.paidByUserId,
        createdByUserId: input.paidByUserId,
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

- [ ] **Step 2: Confirm dev server compiles**

Run in background: `npm run dev`. Wait ~10s, read output, expect `Ready in <Xms>` with no compile errors. Kill the background server.

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/expense.ts
git commit -m "feat(api): snapshot createdByUserId on expense create"
```

---

## Task 3: `expense.update` writes audit rows

**Files:**
- Modify: `src/server/api/routers/expense.ts`

- [ ] **Step 1: Update imports**

In `src/server/api/routers/expense.ts`, ensure the schema import includes `expenseAudits`:

```ts
import {
    expenses,
    expenseAudits,
    expenseSplits,
    groupCurrencies,
    groupMembers,
    groups,
    settlements,
    users,
} from '~/server/db/schema'
```

- [ ] **Step 2: Replace the `update` mutation**

Find the existing `update` procedure in `src/server/api/routers/expense.ts`. Replace it entirely with:

```ts
update: publicProcedure
    .input(
        z.object({
            expenseId: z.number(),
            title: z.string().min(1).optional(),
            category: z.string().optional(),
            notes: z.string().optional(),
            expenseDate: z.date().optional(),
            paidByUserId: z.string().optional(),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const { expenseId, ...rest } = input
        const patch = Object.fromEntries(
            Object.entries(rest).filter(([, v]) => v !== undefined)
        )
        if (Object.keys(patch).length === 0) return { success: true }

        try {
            await ctx.db.transaction(async (trx) => {
                const [current] = await trx
                    .select({
                        groupId: expenses.groupId,
                        createdByUserId: expenses.createdByUserId,
                        title: expenses.title,
                        category: expenses.category,
                        notes: expenses.notes,
                        expenseDate: expenses.expenseDate,
                        paidByUserId: expenses.paidByUserId,
                    })
                    .from(expenses)
                    .where(eq(expenses.id, expenseId))
                    .execute()

                if (!current) {
                    throw new Error('Expense not found')
                }

                const changed: string[] = []
                for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
                    const next = patch[key]
                    const prev = (current as Record<string, unknown>)[key]
                    if (next instanceof Date && prev instanceof Date) {
                        if (next.getTime() !== prev.getTime()) changed.push(key)
                    } else if (next !== prev) {
                        changed.push(key)
                    }
                }

                await trx
                    .update(expenses)
                    .set(patch)
                    .where(eq(expenses.id, expenseId))
                    .execute()

                if (changed.length > 0) {
                    await trx.insert(expenseAudits).values({
                        expenseId,
                        groupId: current.groupId,
                        actorId: current.createdByUserId,
                        fieldsChanged: changed,
                    })
                }
            })
            return { success: true }
        } catch (error) {
            console.error('Error updating expense:', error)
            throw new Error('Failed to update expense')
        }
    }),
```

Behaviour change vs the existing mutation:
- Wraps the update in a transaction so the audit row and the expense update commit atomically.
- Computes `changed` server-side by selecting the current row and comparing each patched field.
- Inserts one audit row when at least one field actually differs. Identity edits (e.g. saving the same value) do not produce audit rows.

- [ ] **Step 3: Manually verify in Drizzle Studio**

Run in background: `npm run dev`. In another terminal, open the dev app, edit an expense (change the title), save. Stop the dev server.

Run: `npm run db:studio`. In the `owe-wari_expense_audits` table, expect to see one row referencing the edited expense with `fields_changed = {title}` and `actor_id` matching the original creator.

Edit the same expense again, this time without changing anything (re-save with the same values). Refresh `expense_audits` — no new row should appear.

- [ ] **Step 4: Commit**

```bash
git add src/server/api/routers/expense.ts
git commit -m "feat(api): write audit row on expense.update"
```

---

## Task 4: `expense.getHistory` returns edit events

**Files:**
- Modify: `src/server/api/routers/expense.ts`

- [ ] **Step 1: Extend `getHistory` with a third source**

Open `src/server/api/routers/expense.ts`. Find the `getHistory` procedure. The current body fetches `expenseRows` and `settlementRows` then merges. Add a third source — `auditRows` — between the existing two select blocks. The new full body of the `try` block:

```ts
const expenseRows = await ctx.db
    .select({
        id: expenses.id,
        title: expenses.title,
        amount: expenses.amount,
        currency: expenses.currency,
        actorId: expenses.paidByUserId,
        actorName: users.name,
        at: expenses.createdAt,
    })
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.paidByUserId))
    .where(eq(expenses.groupId, input.groupId))
    .execute()

const payerUsers = alias(users, 'payer_users')
const receiverUsers = alias(users, 'receiver_users')

const settlementRows = await ctx.db
    .select({
        id: settlements.id,
        amount: settlements.amount,
        currency: settlements.currency,
        actorId: settlements.payerId,
        actorName: payerUsers.name,
        receiverId: settlements.receiverId,
        receiverName: receiverUsers.name,
        at: settlements.settledAt,
    })
    .from(settlements)
    .innerJoin(payerUsers, eq(payerUsers.id, settlements.payerId))
    .innerJoin(receiverUsers, eq(receiverUsers.id, settlements.receiverId))
    .where(eq(settlements.groupId, input.groupId))
    .execute()

const auditRows = await ctx.db
    .select({
        id: expenseAudits.id,
        expenseId: expenseAudits.expenseId,
        title: expenses.title,
        actorId: expenseAudits.actorId,
        actorName: users.name,
        fieldsChanged: expenseAudits.fieldsChanged,
        at: expenseAudits.createdAt,
    })
    .from(expenseAudits)
    .innerJoin(expenses, eq(expenses.id, expenseAudits.expenseId))
    .innerJoin(users, eq(users.id, expenseAudits.actorId))
    .where(eq(expenseAudits.groupId, input.groupId))
    .execute()

const events = [
    ...expenseRows.map((r) => ({ type: 'expense' as const, ...r })),
    ...settlementRows.map((r) => ({ type: 'settlement' as const, ...r })),
    ...auditRows.map((r) => ({ type: 'edit' as const, ...r })),
]

events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

return events
```

The `users` table aliasing: the audit-row select joins `users` once on `actorId`. This reuses the same `users` import (no alias needed) because each select runs as its own query. The settlements select still uses `payerUsers` / `receiverUsers` aliases as before.

- [ ] **Step 2: Confirm dev server compiles**

Run in background: `npm run dev`. Wait ~10s. Expect `Ready in <Xms>`. Kill the server.

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/expense.ts
git commit -m "feat(api): include edit events in getHistory"
```

---

## Task 5: History page renders edit rows

**Files:**
- Modify: `src/app/groups/[groupId]/history/page.tsx`

- [ ] **Step 1: Add a humanized field label map**

Near the top of `src/app/groups/[groupId]/history/page.tsx`, after the imports, add:

```ts
const FIELD_LABELS: Record<string, string> = {
    title: 'title',
    category: 'category',
    notes: 'notes',
    expenseDate: 'date',
    paidByUserId: 'payer',
}

function humanizeFields(fields: string[]): string {
    return fields.map((f) => FIELD_LABELS[f] ?? f).join(', ')
}
```

- [ ] **Step 2: Render edit rows**

In the same file, find the block that renders event rows. The current ternary inside the description column handles `event.type === 'expense'` vs the settlement branch. Extend it to also handle `'edit'`. The full description column block becomes:

```tsx
<div style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem', color: 'var(--body)' }}>
    {event.type === 'expense' && (
        <>
            <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
            {' added '}
            <span style={{ fontStyle: 'italic' }}>&quot;{event.title}&quot;</span>{' '}
            <span className="font-mono" style={{ color: 'var(--amber)' }}>{amount}</span>
        </>
    )}
    {event.type === 'settlement' && (
        <>
            <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
            {' settled '}
            <span className="font-mono" style={{ color: 'var(--amber)' }}>{amount}</span>
            {' with '}
            <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.receiverName}</span>
        </>
    )}
    {event.type === 'edit' && (
        <>
            <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
            {' edited '}
            <span style={{ fontStyle: 'italic' }}>&quot;{event.title}&quot;</span>{' '}
            <span style={{ color: 'var(--muted)' }}>({humanizeFields(event.fieldsChanged)})</span>
        </>
    )}
</div>
```

Note: edit rows do not render an `amount`. The existing `amount` variable (computed at the top of the row map) is still derived once for all rows; for `edit` events the value is unused. To avoid running `parseFloat` on an undefined value, gate that computation:

Find this line near the start of the `events!.map((event, i) => {` block:

```ts
const amount = formatAmount(parseFloat(event.amount), event.currency)
```

Replace with:

```ts
const amount =
    event.type === 'edit'
        ? ''
        : formatAmount(parseFloat(event.amount), event.currency)
```

- [ ] **Step 3: Update the type icon**

In the same row map, find the icon `<div>` that currently picks an icon based on `event.type === 'expense' ? '+' : '↔'`. Replace its content and styling with:

```tsx
<div
    aria-hidden
    style={{
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        background:
            event.type === 'expense'
                ? 'rgba(242,160,7,0.12)'
                : event.type === 'settlement'
                ? 'rgba(52,211,153,0.12)'
                : 'var(--surface-3)',
        color:
            event.type === 'expense'
                ? 'var(--amber)'
                : event.type === 'settlement'
                ? 'var(--green)'
                : 'var(--body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 700,
        flexShrink: 0,
    }}
>
    {event.type === 'expense' ? '+' : event.type === 'settlement' ? '↔' : '✏'}
</div>
```

- [ ] **Step 4: Update the row key for the new event type**

The row's `key` currently looks like:

```tsx
key={`${event.type}-${event.id}`}
```

This is already fine for edit rows because `event.id` is the audit row ID (unique within `expense_audits`). No change needed — verify the key is still in place.

- [ ] **Step 5: Manual verification**

Run in background: `npm run dev`. Open a group, edit one expense (change the title), then visit `/history`. Expect:
- A new row at the top with `✏` icon, `Alice edited "<new title>" (title)`, and a relative timestamp.
- Existing expense and settlement rows render unchanged.

Edit the same expense changing two fields (title + payer). Refresh history. Expect the topmost row to read `(title, payer)`.

Kill the dev server.

- [ ] **Step 6: Lint check**

Run: `npm run lint 2>&1 | grep "history/page"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/app/groups/\[groupId\]/history/page.tsx
git commit -m "feat(ui): render edit events on history page"
```

---

## Task 6: Seed an edit in the screenshot script

**Files:**
- Modify: `scripts/screenshot.mjs`

- [ ] **Step 1: Edit one of the seeded expenses**

Open `scripts/screenshot.mjs`. The `seedTestGroup` function currently creates expenses, then a settlement, then returns. After the settlement block (which logs `↔ Settlement: ...`), insert a new block that fetches the expenses and edits the first one:

```js
    // Seed one settlement so the history page demos both event types.
    if (userIds.length >= 2) {
        await callTRPC('expense.settleUp', {
            groupId,
            payerId: userIds[1],
            receiverId: userIds[0],
            lines: [{ currency: 'SGD', amount: 12.5 }],
        })
        console.log(`   ↔ Settlement: ${users[1].name} → ${users[0].name} SGD 12.50`)
    }

    // Seed one expense edit so history demos the edit event type.
    const expensesList = await callTRPC('expense.getExpenses', { groupId }, 'query')
    const firstExpense = expensesList?.[0]
    if (firstExpense) {
        await callTRPC('expense.update', {
            expenseId: firstExpense.id,
            title: 'Airport taxi (corrected)',
        })
        console.log(`   ✏ Edited: expense #${firstExpense.id} → title`)
    }

    return { groupId, users }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/screenshot.mjs
git commit -m "chore(screenshot): seed an expense edit to demo history"
```

---

## Task 7: Regenerate the history screenshot

**Files:**
- Refresh: `screenshots/07-group-history.png`

- [ ] **Step 1: Start the dev server in the background**

Run in background: `npm run dev`. Wait ~10 seconds. Read the output to find the bound port (3000 if free, otherwise 3001/3002/...).

- [ ] **Step 2: Run the screenshot script**

If on port 3000:

```bash
npm run screenshot
```

Otherwise (e.g. port 3003):

```bash
BASE_URL=http://localhost:3003 npm run screenshot
```

Expected: `✅  All screenshots saved to screenshots/`. The seed now creates expenses, a settlement, and one edit.

- [ ] **Step 3: Visually verify the history screenshot**

Open `screenshots/07-group-history.png`. Confirm:
- Newest row: an `✏` edit row with the actor name, the (post-edit) title `Airport taxi (corrected)`, and `(title)` in muted text.
- Below: the settlement row.
- Below: four expense rows with their currency-formatted amounts.
- Relative timestamps on the right.

If the edit row is missing, double-check Task 6 changes and re-run.

- [ ] **Step 4: Stop the dev server**

Use the `TaskStop` tool (or kill the background shell ID) to terminate the dev server.

- [ ] **Step 5: Commit only the history screenshot**

Other screenshots may show pixel diffs from the fresh seed. Discard those and commit only `07-group-history.png`:

```bash
git checkout -- screenshots/01-home.png screenshots/02-groups-list.png screenshots/03-create-group.png screenshots/04-group-summary.png screenshots/05-group-expenses.png screenshots/06-group-balances.png screenshots/08-group-settings.png screenshots/09-create-expense.png
git add screenshots/07-group-history.png
git commit -m "docs: regenerate history screenshot with seeded edit"
```

---

## Final verification

- [ ] **Lint clean for changed files**

Run: `npm run lint 2>&1 | tail -25`
Expected: no NEW errors introduced in `src/server/db/schema.ts`, `src/server/api/routers/expense.ts`, or `src/app/groups/[groupId]/history/page.tsx`. Pre-existing errors elsewhere are out of scope.

- [ ] **End-to-end smoke**

Boot the dev app:
1. Open a group with at least one expense and one settlement.
2. Edit an expense (change the title). Confirm the change saves and the new title is reflected in the expense list.
3. Visit `/history`. Confirm a new edit event appears at the top with the original payer's name as the actor, the post-edit title, and `(title)` listed.
4. Edit the same expense changing only the payer to someone different. Visit `/history`. Confirm the new edit row says `(payer)`. Confirm the previous edit row still says `(title)`.
5. Edit the expense with no actual change (re-save). Visit `/history`. Confirm no new row appeared.

- [ ] **Push and open PR**

```bash
git push -u origin feat/expense-edit-audit
gh pr create --title "feat: log expense edits in history" --body "$(cat <<'EOF'
## Summary
- Adds `expenses.created_by_user_id` — a never-updated snapshot of `paid_by_user_id` set at creation time. Backfilled for existing rows.
- Adds `expense_audits` table — one row per edit, recording which field names changed and the actor (the creation-time payer).
- `expense.update` server-side diffs the patch against the current row and writes an audit row when at least one tracked field actually changed. Identity-edits do not produce rows.
- `expense.getHistory` returns a new \`edit\` event variant.
- History page renders edit rows with a `✏` icon and humanized field-name list (e.g. `Alice edited "Dinner" (title, payer)`).

## Out of scope
- LocalStorage / per-group identity prompt. Attribution is derived from the snapshotted creator. Trade-off: if a different group member edits the expense, the log still credits the creator. Acceptable for a small-trust friend group.
- Before/after value snapshots. Only field names are stored.

## Design + plan
- Spec: docs/plans/2026-05-03-expense-edit-audit-design.md
- Plan: docs/plans/2026-05-03-expense-edit-audit-plan.md

## Test plan
- [ ] Edit an expense; confirm a new \`edit\` event appears at the top of History with the correct actor and changed field list.
- [ ] Re-save with no actual changes; confirm no event is added.
- [ ] Edit only the payer; confirm \`(payer)\` is the only label.
- [ ] Existing expenses load; \`createdByUserId\` was backfilled.
- [ ] \`npm run lint\` introduces no new errors.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
