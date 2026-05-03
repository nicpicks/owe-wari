# Expense Edit Audit — Design

## Goal

Surface expense edits on the History page. Each edit appears as a new event with the actor's name and a list of changed field names. No identity prompt or localStorage; edit attribution is derived from a creation-time snapshot of the original payer.

## Scope

- Add `expenses.createdByUserId` — a never-updated snapshot of `paidByUserId` at creation time. Backfilled to `paidByUserId` for existing rows.
- Add `expense_audits` table — one row per edit, recording which field names changed and who's attributed (the original creator).
- `expense.update` performs a server-side diff and inserts an audit row when at least one tracked field actually changed.
- `expense.getHistory` returns a third event variant (`edit`).
- History page renders edit rows with a distinctive icon and humanized field-name list.

## Out of scope (intentionally)

- Localstorage / per-group identity / picker UX. The audit actor is computed from data, not collected from the user.
- Before/after value snapshots. Only the set of changed field names is logged.
- Auditing settlements or expense creates. Those events are already surfaced in the History page from their primary tables.
- Auditing deletes. No delete mutation exists.
- Editing `amount`, `currency`, or splits. The `expense.update` mutation does not currently allow these; they remain out of scope.

## Attribution caveat

Every edit is attributed to the expense's `createdByUserId` — i.e., whoever paid for it at creation time. If a different group member edits the expense later, the audit log still says the creator did it. This is a deliberate trade-off: zero UX friction at the cost of fidelity. Acceptable for a small-trust friend group; revisit if the app grows.

`createdByUserId` is intentionally immutable. Even when `expense.update` changes `paidByUserId`, the snapshot stays so the attribution remains stable.

## Data model

### `expenses.createdByUserId` — new column

```ts
createdByUserId: varchar('created_by_user_id', { length: 26 })
    .references(() => users.id)
    .notNull()
```

- Set on insert: `createdByUserId = paidByUserId`.
- Migration adds the column nullable, backfills `createdByUserId = paidByUserId` for all existing rows, then sets `NOT NULL` (Drizzle migration via `drizzle-kit generate`).
- An index on `createdByUserId` is not necessary for v1 — no query filters by it; it's read alongside the row when computing audit attribution.

### `expense_audits` — new table

```ts
expenseAudits: createTable(
    'expense_audits',
    {
        id: serial('id').primaryKey().notNull(),
        expenseId: integer('expense_id').references(() => expenses.id).notNull(),
        groupId: varchar('group_id', { length: 26 }).references(() => groups.id).notNull(),
        actorId: varchar('actor_id', { length: 26 }).references(() => users.id).notNull(),
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

- `groupId` is denormalized so `getHistory` can filter without joining `expenses` for the audit-source select. The cost is one extra varchar per audit row, which is trivial.
- `fieldsChanged` is a `text[]` Postgres array. Drizzle's `.array()` modifier handles serialization.
- `actorId` is the original creator (`expenses.createdByUserId`) at the moment the audit row is written.

## Backend

### `expense.create` — modified

Set `createdByUserId = input.paidByUserId` on insert. No new client input.

### `expense.update` — modified

Inside the existing transaction, before the row update:

1. Select the current expense row, projecting `groupId`, `createdByUserId`, and every editable field (`title`, `category`, `notes`, `expenseDate`, `paidByUserId`).
2. Compute `changed: string[]` — entries in `patch` whose value differs from the corresponding column on the current row. Only fields with a non-undefined patch value participate; equal values do not appear.
3. Apply the existing `.update().set(patch)`.
4. If `changed.length > 0`, insert one row into `expense_audits` with `actorId = current.createdByUserId`, `fieldsChanged = changed`, `groupId = current.groupId`.

Most tracked fields are strings (compare with `!==`). `expenseDate` is a `Date` — compare via `.getTime()` so two `Date` instances representing the same instant don't register as changed.

The mutation gains no new input parameters. If the patch was empty (or every field matches the current value), no audit row is written and the existing fast-path return remains.

### `expense.getHistory` — extended

Add a third parallel select against `expense_audits`, joined to `expenses` for `title` and `currency`, and to `users` for `actorName`. Merge into the event array as a new variant:

```ts
| {
      type: 'edit'
      id: number              // expense_audits.id
      expenseId: number
      title: string            // expenses.title — current value (the documented wart)
      actorId: string          // expense_audits.actorId
      actorName: string
      fieldsChanged: string[]
      at: Date                 // expense_audits.createdAt
  }
```

The merge sort (newest first) is unchanged.

## Frontend

### Edit modal (`src/app/_components/expense-detail-modal.tsx`)

No changes. The audit row is invisible to the editor; the existing flow continues to work.

### History page (`src/app/groups/[groupId]/history/page.tsx`)

Add a third row variant for `edit` events. Visual distinction:

- Icon: `✏` glyph in the same square-icon container as the existing event types. Color: a neutral `var(--muted)` background with `var(--body)` foreground (so it reads as "informational" rather than "money").
- Sentence: `Alice edited "Dinner" (title, payer)`.
  - `actorName` is bold.
  - Title is wrapped in italic quotes (matches the existing expense-row format).
  - Field names are humanized via a small constant lookup. The full mapping:
    ```ts
    const FIELD_LABELS: Record<string, string> = {
        title: 'title',
        category: 'category',
        notes: 'notes',
        expenseDate: 'date',
        paidByUserId: 'payer',
    }
    ```
    Joined with `, ` inside parentheses. Unknown field keys (defensive) fall back to the raw key.
- Right-aligned timestamp uses the existing `formatRelative` helper.

No avatar lookup needed beyond what already happens for expense rows — the actor's initial is rendered identically.

## Validation rules

- `expense.update`: rejects when the parent expense's `createdByUserId` references a user no longer in the group. (Defensive only — currently impossible since users can't be removed.)
- `expense_audits.fieldsChanged` is never written empty; the insert is skipped when no fields actually changed.

## Migration steps

The project switched to Drizzle migrations recently. The work flow:

1. Edit `src/server/db/schema.ts` — add the column to `expenses` and the new `expenseAudits` table.
2. Run `npm run db:generate` to produce a migration file under `drizzle/`.
3. Manually edit the generated SQL to:
   - Add `created_by_user_id` as `varchar(26)` (nullable initially).
   - `UPDATE "owe-wari_expenses" SET "created_by_user_id" = "paid_by_user_id" WHERE "created_by_user_id" IS NULL;` — backfill.
   - `ALTER TABLE "owe-wari_expenses" ALTER COLUMN "created_by_user_id" SET NOT NULL;` — enforce.
   - The `expense_audits` table is fine to add as generated.
4. Run `npm run db:migrate` locally and on production.

## Verification

1. Open an existing group. Edit an expense (e.g., change the title). Confirm it saves successfully.
2. Open the History tab. Confirm a new `edited` row appears at the top with the correct actor name (the original payer), title, and changed field names.
3. Edit only the payer. Confirm the audit row says `(payer)` only.
4. Edit and save with no actual changes (e.g., re-pick the same category). Confirm no audit row is written and the page shows no new event.
5. After backfill, existing expenses' details panel still shows the correct payer; nothing visible changes for unedited expenses.
6. `npm run lint` introduces no new errors in changed files.
7. Run `npm run screenshot` after the screenshot script is updated to also edit one of the seeded expenses, then commit `screenshots/07-group-history.png` to demo the new event type alongside expense-add and settlement events.
