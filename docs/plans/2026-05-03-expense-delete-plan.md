# Expense Delete Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft-delete expenses. Deleted expenses vanish from every list and balance, but appear in History as a `delete` event. Reuses the audit feature's `createdByUserId` snapshot for actor attribution.

**Architecture:** Add `expenses.deletedAt` (nullable timestamp). New `expense.delete` mutation. Every read query that powers a "current" view filters `deletedAt IS NULL`. `expense.getHistory` adds a fourth parallel select sourced from `expenses` rows with `deletedAt IS NOT NULL`. The History page renders delete rows with a `✕` icon and red tint. The expense detail modal gains a Delete button with an inline two-tap confirm.

**Tech Stack:** Next.js 14 App Router, tRPC, Drizzle ORM, PostgreSQL, React, Tailwind + DaisyUI.

**Spec:** [`docs/plans/2026-05-03-expense-delete-design.md`](./2026-05-03-expense-delete-design.md)

---

## File Structure

**Created:**
- `drizzle/0007_expense_soft_delete.sql`

**Modified:**
- `src/server/db/schema.ts` — add `expenses.deletedAt`
- `src/server/api/routers/expense.ts` — add `delete` mutation, filter all reads, guard `update`, extend `getHistory`
- `src/app/_components/expense-detail-modal.tsx` — Delete button + inline confirm
- `src/app/groups/[groupId]/history/page.tsx` — render delete event rows
- `scripts/screenshot.mjs` — delete one seeded expense so the screenshot demos the new event

**Refreshed:**
- `screenshots/07-group-history.png`

---

## Task 1: Schema and migration

- [ ] **Step 1: Add `deletedAt` to `expenses` in `src/server/db/schema.ts`**

Insert directly under `updatedAt` in the `expenses` columns block:

```ts
deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

No `.notNull()`, no default — `null` is the active state.

- [ ] **Step 2: Hand-write `drizzle/0007_expense_soft_delete.sql`**

```sql
ALTER TABLE "owe-wari_expenses" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
```

Single statement. Existing rows become `null` (active). Mirror the style of `0005_settlements_currency.sql`.

- [ ] **Step 3: Apply locally**

`npm run db:migrate`. Verify in Drizzle Studio that `owe-wari_expenses` has the new nullable column and every existing row has `deleted_at = NULL`.

---

## Task 2: `expense.delete` mutation

- [ ] **Step 1: Add `isNull` / `isNotNull` to the drizzle-orm import**

In `src/server/api/routers/expense.ts`:

```ts
import { eq, sql, and, isNull, isNotNull } from 'drizzle-orm'
```

- [ ] **Step 2: Append the `delete` procedure**

Add after the existing `settleUp` mutation (or grouped with `update` — pick the spot consistent with the file's ordering):

```ts
delete: publicProcedure
    .input(z.object({ expenseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
        try {
            await ctx.db.transaction(async (trx) => {
                await trx
                    .update(expenses)
                    .set({ deletedAt: new Date() })
                    .where(and(eq(expenses.id, input.expenseId), isNull(expenses.deletedAt)))
                    .execute()
            })
            return { success: true }
        } catch (error) {
            console.error('Error deleting expense:', error)
            throw new Error('Failed to delete expense')
        }
    }),
```

The `AND deletedAt IS NULL` clause makes the operation idempotent — re-calls are no-ops returning success.

---

## Task 3: Filter every read query

- [ ] **Step 1: `getExpenses`** — change the `where` to:

```ts
.where(and(eq(expenses.groupId, input.groupId), isNull(expenses.deletedAt)))
```

- [ ] **Step 2: `getExpense`** — change the `where` to:

```ts
.where(and(eq(expenses.id, input.expenseId), isNull(expenses.deletedAt)))
```

The existing `if (!expense) throw new Error('Expense not found')` line correctly handles the filtered-out case.

- [ ] **Step 3: `getTotalExpenseCost`** — both aggregates need the filter. Update each `where`:

```ts
// defaultRow
.where(and(
    eq(expenses.groupId, input.groupId),
    eq(expenses.currency, group.defaultCode),
    isNull(expenses.deletedAt),
))

// otherRow
.where(and(
    eq(expenses.groupId, input.groupId),
    sql`${expenses.currency} <> ${group.defaultCode}`,
    isNull(expenses.deletedAt),
))
```

- [ ] **Step 4: `getBalances`** — `paidRows` and `owedRows`:

```ts
// paidRows
.where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)))

// owedRows (already joins expenses)
.where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)))
```

`receivedRows` and `settledRows` do not touch `expenses` — leave them.

- [ ] **Step 5: `getHistory`** — only the new `deleteRows` source filters by `deletedAt`. The existing `expenseRows` and `auditRows` selects do **not** filter; we want the "added" and "edited" events to remain in history even after a delete.

---

## Task 4: `expense.update` rejects deleted expenses

- [ ] **Step 1: Add `deletedAt` to the projection**

In the `current` SELECT inside `update`:

```ts
.select({
    groupId: expenses.groupId,
    createdByUserId: expenses.createdByUserId,
    deletedAt: expenses.deletedAt,
    title: expenses.title,
    category: expenses.category,
    notes: expenses.notes,
    expenseDate: expenses.expenseDate,
    paidByUserId: expenses.paidByUserId,
})
```

- [ ] **Step 2: Add the guard**

Right after the `if (!current) { throw new Error('Expense not found') }` check:

```ts
if (current.deletedAt !== null) {
    throw new Error('Cannot edit a deleted expense')
}
```

- [ ] **Step 3: Exclude `deletedAt` from the diff loop**

The `for (const key of Object.keys(patch))` loop already only iterates over patched fields, and `deletedAt` is never in the input schema — no change needed. Just verify by reading the input zod schema to confirm.

---

## Task 5: `getHistory` returns delete events

- [ ] **Step 1: Add the fourth source to the `Promise.all`**

Append to the array passed to `Promise.all`:

```ts
ctx.db
    .select({
        id: expenses.id,
        title: expenses.title,
        actorId: expenses.createdByUserId,
        actorName: users.name,
        at: expenses.deletedAt,
    })
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.createdByUserId))
    .where(and(eq(expenses.groupId, input.groupId), isNotNull(expenses.deletedAt)))
    .execute(),
```

Destructure into `deleteRows`:

```ts
const [expenseRows, settlementRows, auditRows, deleteRows] = await Promise.all([...])
```

- [ ] **Step 2: Merge into the events array**

```ts
const events = [
    ...expenseRows.map((r) => ({ type: 'expense' as const, ...r })),
    ...settlementRows.map((r) => ({ type: 'settlement' as const, ...r })),
    ...auditRows.map((r) => ({ type: 'edit' as const, ...r })),
    ...deleteRows.map((r) => ({ type: 'delete' as const, ...r })),
]
```

The `at` field on a delete event comes from `expenses.deletedAt` — non-null because of the `isNotNull` filter, so the existing `events.sort` works without change.

`deleteRows` returns `at: Date | null` typed (because the column is nullable), but the runtime value is always `Date` after the filter. Drizzle won't infer this from the WHERE clause — TypeScript will show `at: Date | null` on the merged event. The `events.sort` calls `new Date(b.at).getTime()`; `new Date(null)` is the epoch, which would still sort, but to keep things clean cast it to non-null when mapping:

```ts
...deleteRows.map((r) => ({ type: 'delete' as const, ...r, at: r.at! })),
```

---

## Task 6: Delete button + inline confirm in expense detail modal

- [ ] **Step 1: Add `isConfirmingDelete` state and the mutation**

In `src/app/_components/expense-detail-modal.tsx`, near the other `useState` hooks:

```ts
const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
```

Reset it on close (alongside the existing `setIsEditing(false)` effect).

Add the mutation after `updateExpense`:

```ts
const deleteExpense = api.expense.delete.useMutation({
    onSuccess: async () => {
        await Promise.all([
            utils.expense.getExpenses.invalidate({ groupId }),
            utils.expense.getTotalExpenseCost.invalidate({ groupId }),
            utils.expense.getBalances.invalidate({ groupId }),
            utils.expense.getHistory.invalidate({ groupId }),
        ])
        onClose()
    },
    onError: (e) => {
        console.error(e)
        alert('Failed to delete expense')
    },
})
```

- [ ] **Step 2: Add the Delete button next to Edit**

In the header `div` containing Edit and Close, between Edit and Close:

```tsx
{!isEditing && expense && (
    <button
        onClick={() => setIsConfirmingDelete(true)}
        className="btn-ghost text-sm"
        style={{ color: 'var(--red)' }}
        aria-label="Delete"
    >
        Delete
    </button>
)}
```

- [ ] **Step 3: Render the inline confirm strip**

Replace the title row entirely when `isConfirmingDelete`. The existing header `div` becomes:

```tsx
{isConfirmingDelete ? (
    <div className="mb-4 flex items-center justify-between gap-2">
        <span style={{ color: 'var(--heading)', fontWeight: 600 }}>
            Delete this expense?
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
                onClick={() => setIsConfirmingDelete(false)}
                className="btn-ghost text-sm"
                disabled={deleteExpense.isPending}
            >
                Cancel
            </button>
            <button
                onClick={() => expense && deleteExpense.mutate({ expenseId: expense.id })}
                className="btn-ghost text-sm"
                style={{ color: 'var(--red)' }}
                disabled={deleteExpense.isPending}
            >
                {deleteExpense.isPending ? 'Deleting…' : 'Delete'}
            </button>
        </div>
    </div>
) : (
    <div className="mb-4 flex items-start justify-between gap-2">
        {/* existing title + Edit + Close header */}
    </div>
)}
```

The cancel button restores the normal header. The confirm button calls the mutation; on success, the modal closes via `onClose()`.

---

## Task 7: History page renders delete rows

- [ ] **Step 1: Extend `TYPE_ICON`**

In `src/app/groups/[groupId]/history/page.tsx`:

```ts
const TYPE_ICON = {
    expense:    { bg: 'rgba(242,160,7,0.12)',  fg: 'var(--amber)', glyph: '+' },
    settlement: { bg: 'rgba(52,211,153,0.12)', fg: 'var(--green)', glyph: '↔' },
    edit:       { bg: 'var(--surface-3)',      fg: 'var(--body)',  glyph: '✏' },
    delete:     { bg: 'rgba(239,68,68,0.12)',  fg: 'var(--red)',   glyph: '✕' },
} as const
```

- [ ] **Step 2: Add the fourth render branch**

After the `event.type === 'edit'` block:

```tsx
{event.type === 'delete' && (
    <>
        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
        {' deleted '}
        <span style={{ fontStyle: 'italic' }}>&quot;{event.title}&quot;</span>
    </>
)}
```

The `${event.type}-${event.id}` row key remains unique because delete events use `expenses.id` and `${type}` differentiates them from `expense` rows that share the same id.

---

## Task 8: Seed a delete in the screenshot script

- [ ] **Step 1: Edit `scripts/screenshot.mjs`**

After the `expense.update` block (which seeds the edit event), add:

```js
// Seed one delete so history demos the delete event type.
const deletable = expensesList?.[1]
if (deletable) {
    await callTRPC('expense.delete', { expenseId: deletable.id })
    console.log(`   ✕ Deleted: expense #${deletable.id}`)
}
```

Pick `expensesList[1]` (the second expense) so the edited expense remains visible in the Expenses tab and the deleted one shows up only in History.

---

## Task 9: Regenerate the history screenshot

- [ ] **Step 1: Run dev server + screenshot script**

Same pattern as the audit feature plan — boot `npm run dev`, then `npm run screenshot` (with `BASE_URL` if dev picked a non-3000 port).

- [ ] **Step 2: Verify the screenshot**

Open `screenshots/07-group-history.png`. Confirm, top to bottom:
- A `✕` delete row.
- A `✏` edit row.
- A `↔` settlement row.
- Three `+` expense rows (one of the four seeded was deleted, but its "added" event still appears).

- [ ] **Step 3: Commit only the history screenshot**

Discard pixel-diff changes to other screenshots that result from the random seed.

---

## Final verification

- [ ] **Lint clean for changed files**

`npm run lint` should not introduce new errors in:
- `src/server/db/schema.ts`
- `src/server/api/routers/expense.ts`
- `src/app/_components/expense-detail-modal.tsx`
- `src/app/groups/[groupId]/history/page.tsx`

- [ ] **End-to-end smoke**

1. Boot the dev app, open a group with multiple expenses, a settlement, and an edit (from prior feature).
2. Open the detail modal for one expense. Click Delete → Cancel. Confirm the modal returns to its normal header.
3. Click Delete → Delete. Confirm the modal closes and the expense disappears from the Expenses tab.
4. Visit the Summary tab — total decreases by the deleted amount.
5. Visit the Balances tab — affected users' net balance updates.
6. Visit the History tab — a `✕` row appears at the top. The original `+` add row for the same expense is still present below.
7. From a stale tab (or via Drizzle Studio: re-set `deletedAt = NULL` and try delete twice in quick succession), confirm a second `expense.delete` call returns success without producing duplicate history rows.
8. Try editing a deleted expense via Drizzle Studio (set deletedAt back to a value, then call `expense.update` from the UI) — server returns "Cannot edit a deleted expense".

- [ ] **Push to the working branch**

The branch for this work is whichever branch the user assigned. Do not create a PR unless explicitly asked.
