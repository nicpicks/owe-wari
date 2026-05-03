# Expense Delete — Design

## Goal

Let users delete an expense. Deleted expenses disappear from every list and balance, but remain in the History page as a `delete` event so the chronological record stays intact. Implementation is **soft delete** — a `deletedAt` timestamp on the row — so balances, splits, and audit rows remain referentially valid and the operation is reversible at the DB level.

## Scope

- Add `expenses.deletedAt: timestamp` (nullable). `null` = active; non-null = deleted.
- New `expense.delete` mutation that sets `deletedAt = NOW()`. Idempotent.
- Every existing query that touches `expenses` for "what is currently real" gains a `WHERE deleted_at IS NULL` filter: `getExpenses`, `getExpense`, `getTotalExpenseCost`, `getBalances`.
- `getHistory` returns a fourth event variant (`delete`). Source: rows in `expenses` with `deletedAt IS NOT NULL`. The other three sources (`expense`/`settlement`/`edit`) are **not** filtered — history is permanent.
- `expense.update` rejects updates to deleted expenses (defensive — the UI won't surface them, but a stale tab could try).
- Expense detail modal gains a Delete button with an inline confirmation step.
- History page renders delete rows with a distinctive icon.

## Out of scope

- Undelete UX. The `deletedAt` column is nullable so we *can* add an "undo" later, but no code path sets it back to `null` in v1.
- Hard purge (cron job to drop old soft-deleted rows).
- Cascading deletes for `expense_splits` or `expense_audits`. Both keep their FK to the parent row, which is fine because the parent still exists — only `getBalances`'s join through `expenses` filters them out implicitly via the new `WHERE deleted_at IS NULL`.
- Deleting settlements. Out of scope for this change.
- Bulk delete.

## Attribution

Same rule as the edit audit: the actor on a `delete` event is the expense's `createdByUserId` (snapshotted at create time, never updated). Zero UX friction; the documented trade-off is that any group member can press Delete but the log still credits the original creator. Acceptable for a small-trust friend group.

We deliberately do **not** add a `deletedByUserId` column — it would mirror the same identity-prompt trade-off that the audit feature explicitly opted out of.

## Data model

### `expenses.deletedAt` — new column

```ts
deletedAt: timestamp('deleted_at', { withTimezone: true })
```

- Nullable, no default. `null` = active.
- No partial index in v1 — soft-deleted rows are expected to be a small fraction of the table, and every read filters by `groupId` first which already has an index.
- The column is purely a marker; consumers must filter on it explicitly.

## Backend

### `expense.delete` — new mutation

```ts
delete: publicProcedure
    .input(z.object({ expenseId: z.number() }))
    .mutation(async ({ ctx, input }) => { ... })
```

Behaviour:
1. Wraps in a transaction (consistency with other mutations, even though it's a single statement today).
2. `UPDATE expenses SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL`.
3. The `AND deletedAt IS NULL` clause makes the operation idempotent — a second call is a no-op (zero rows affected, returns success).
4. Returns `{ success: true }`.

No additional audit row is written. The `deletedAt` timestamp on the expense row *is* the audit trail. `getHistory` reads it directly (see below).

### `expense.update` — guard

Inside the existing transaction, after the `current` SELECT, reject the update when `current.deletedAt !== null`:

```ts
if (current.deletedAt !== null) {
    throw new Error('Cannot edit a deleted expense')
}
```

Add `deletedAt: expenses.deletedAt` to the projection.

### Filtering existing queries

Add `isNull(expenses.deletedAt)` to the `where` clause of:

- `expense.getExpenses` — list view
- `expense.getExpense` — detail modal (also throw "Expense not found" if filtered out, matching current behaviour)
- `expense.getTotalExpenseCost` — both the `defaultRow` and `otherRow` aggregates
- `expense.getBalances` — `paidRows` (from `expenses`), `owedRows` (joined to `expenses`)

`expense.getHistory`:
- `expenseRows` (the "added" event source) — **not** filtered. We still want to show the original "added" event for now-deleted expenses.
- `auditRows` (the "edit" event source) — **not** filtered. Same reasoning.
- New `deleteRows` source — `WHERE groupId = ? AND deletedAt IS NOT NULL`.

### `getHistory` — fourth variant

Add a fourth parallel select (same `Promise.all` as the other three):

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
    .execute()
```

Merged into the events array as `{ type: 'delete', ... }`. Sort key remains `at`.

The `at` field is `expenses.deletedAt` (non-null after the filter). The `id` is the expense ID — paired with `type: 'delete'`, the `${type}-${id}` row key stays unique.

## Frontend

### Expense detail modal (`src/app/_components/expense-detail-modal.tsx`)

Add a Delete button alongside the existing Edit button in the header (only when `!isEditing`). Clicking it switches the header to a confirm strip:

```
"Delete this expense?"   [Cancel]  [Delete]
```

On confirm:
1. Call `api.expense.delete.useMutation`.
2. `onSuccess`: invalidate `getExpenses`, `getTotalExpenseCost`, `getBalances`, `getHistory` for the group, then call `onClose()`.
3. `onError`: alert.

The confirm strip is inline (replaces the title row) rather than a separate modal — it's lighter weight and the user is already inside a modal. Two-tap pattern is enough friction for a destructive-but-soft action.

### History page (`src/app/groups/[groupId]/history/page.tsx`)

Add a fourth entry to `TYPE_ICON`:

```ts
delete: { bg: 'rgba(239,68,68,0.12)', fg: 'var(--red)', glyph: '✕' },
```

Add a fourth render branch in the description column:

```tsx
{event.type === 'delete' && (
    <>
        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
        {' deleted '}
        <span style={{ fontStyle: 'italic' }}>&quot;{event.title}&quot;</span>
    </>
)}
```

`event.title` is the current title at delete time (i.e., post-final-edit). Same "documented wart" as edit events.

## Validation rules

- `expense.delete`: idempotent — re-deleting is success, not error. Reading-then-writing inside the same tx with `WHERE deletedAt IS NULL` enforces this without an explicit pre-check.
- `expense.update`: rejects updates when `deletedAt !== null`.
- `expense.create`: unaffected (always inserts active rows).
- All read queries: `WHERE deletedAt IS NULL` is mandatory. A test that lists expenses for a group containing one deleted expense should return one fewer row than `SELECT COUNT(*)` from `expenses` for that group.

## Migration steps

The recent migrations (0003-0005, plus the audit migration 0006) have been hand-written rather than generated. Following the same pattern:

1. Edit `src/server/db/schema.ts` — add `deletedAt` to the `expenses` table.
2. Hand-write `drizzle/0007_expense_soft_delete.sql`:
   ```sql
   ALTER TABLE "owe-wari_expenses" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
   ```
   Single statement. Nullable, no default — existing rows become `null` (active), as expected.
3. Run `npm run db:migrate` locally and on production.

## Verification

1. Open a group. Delete an expense. Confirm:
   - It disappears from the Expenses tab immediately.
   - The Total in the Summary tab decreases by the expense amount.
   - The Balances tab updates (paid/owed for affected users drops).
2. Open the History tab. Confirm a `✕` row at the top: `Alice deleted "Dinner"`.
3. Confirm the original `+ Alice added "Dinner" SGD 48.00` row still appears below — history is preserved.
4. If the expense had an edit beforehand, that edit row also remains.
5. Try clicking the deleted expense from a stale tab (open Expenses, delete from another tab, click the row in the first) — modal shows "Expense not found".
6. Re-call `expense.delete` for the same id (e.g., from Drizzle Studio or a refresh-race) — succeeds without error, no duplicate event.
7. `npm run lint` introduces no new errors in changed files.
8. Run `npm run screenshot` after the screenshot script is updated to also delete one of the seeded expenses; commit `screenshots/07-group-history.png` to demo the new event type.
