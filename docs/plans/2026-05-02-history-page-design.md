# History Page — Design

## Goal

Replace the placeholder History tab with a chronological audit-trail feed of group activity. The first version covers expense creates and settlements; expense edits are intentionally out of scope.

## Scope

- Replace the "coming soon" placeholder at `src/app/groups/[groupId]/history/page.tsx` with a feed.
- Render two event types: expense added, settlement recorded.
- Reverse-chronological (newest first), no pagination.
- Currency-aware amounts via the existing `formatAmount` helper.

Out of scope (intentionally):
- Tracking expense edits. The `expense.update` mutation overwrites in place; capturing edit history needs a new `audit_log` table with before/after snapshots, which is a separate, larger feature.
- Pagination, filtering, search.
- Deletion events (no delete mutation exists).
- Schema changes — none required.
- Per-user activity feeds across groups.

## Data sources

No schema changes. The feed derives events from existing tables.

| Event type   | Source table  | Actor field          | Timestamp field    |
|--------------|---------------|----------------------|--------------------|
| `expense`    | `expenses`    | `paidByUserId`       | `createdAt`        |
| `settlement` | `settlements` | `payerId`            | `settledAt`        |

`paidByUserId` is the closest proxy for "who added the expense" the codebase has. The `expense.update` mutation can change `paidByUserId`, which means historic creates may surface a "current" payer that differs from who actually entered the row. That's acceptable for v1; if it becomes confusing, the right fix is a real `addedByUserId` column, not a history-page workaround.

## Backend

### New tRPC query: `expense.getHistory`

```ts
input: z.object({ groupId: z.string() })

return: HistoryEvent[]   // newest first

type HistoryEvent =
    | {
          type: 'expense'
          id: number              // expenses.id
          title: string
          amount: string
          currency: string
          actorId: string
          actorName: string
          at: Date                // expenses.createdAt
      }
    | {
          type: 'settlement'
          id: number              // settlements.id
          amount: string
          currency: string
          actorId: string         // payerId
          actorName: string
          receiverId: string
          receiverName: string
          at: Date                // settlements.settledAt
      }
```

Implementation: two parallel selects, both filtered by `groupId`. The settlements select joins the `users` table twice (once on `payerId`, once on `receiverId`) for actor and receiver names. Merge in JS, sort by `at` descending. No N+1 query risk.

## Performance

No new indexes. The query plan relies on:
- `idx_expenses_group_id` (already exists)
- `idx_settlements_group_id` (added by perf PR #21)

Both selects scan a few rows by group, then fetch user rows by primary key. Sort happens in JS on a small merged list.

Group sizes are small enough that pagination isn't needed; the full feed loads in one round-trip.

## Frontend

### File: `src/app/groups/[groupId]/history/page.tsx`

Replace the placeholder body with a single `card-dark` containing one row per event.

### Row layout

```
[icon]  [avatar]  Alice added "Dinner" S$50.00          2h ago
[icon]  [avatar]  Bob settled ¥3,000 with Alice         yesterday
```

- **Icon** (16x16, left-most): "+" for expense, "↔" for settlement. Visual differentiation at a glance.
- **Avatar** (28x28 circle, initial): same component style as the summary and balances pages — pulls from the existing `--surface-3` / `--border-2` palette.
- **Description** (middle, flex 1): event sentence with the amount rendered via `formatAmount(amount, currency)`. The expense title is wrapped in quotes; the actor name is bold (`var(--heading)`).
- **Timestamp** (right): relative time ("just now", "2h ago", "yesterday", "3d ago", "Mar 5"). The project currently has only an inline `formatDate` for absolute dates inside the expense detail modal — this work adds a new `src/lib/format-date.ts` exporting `formatRelative(at: Date)`. Use it on the history page; leave the inline `formatDate` in the modal alone (no opportunistic refactor).

### Empty state

When there are zero events, render a centered icon + "No activity yet" — same visual style as the existing placeholder, but with the body copy adjusted.

### Loading state

Match the existing pattern from balances/summary — a `Loading…` line in `var(--muted)` while `isLoading` is true.

### Animation

Each row gets `anim-fade-up d-${Math.min(i + 1, 8)}` to match the staggered fade pattern used elsewhere in the app.

## Validation rules

- The `getHistory` query rejects empty `groupId`.
- Events with missing actor/receiver users (deleted users — currently not possible since there is no delete) are filtered out defensively to avoid rendering blanks.

## Verification

1. Open a group with mixed expenses (multi-currency) and at least one settlement. Confirm:
   - Both event types render with correct icon, actor name, amount, and currency formatting.
   - Newest event is at the top.
   - Relative timestamps look right ("just now" right after creating an expense, etc.).
2. Open a fresh group with zero activity. Confirm the empty state renders cleanly.
3. Settle up a pair, then refresh the history page. The new settlement appears as the top row.
4. `npm run lint` introduces no new errors in the changed files.
5. Run `npm run screenshot` and confirm `screenshots/07-group-history.png` now shows the populated feed (the screenshot script already seeds expenses; add a synthetic settlement step or accept that the screenshot will show only expense events for the seed group).
