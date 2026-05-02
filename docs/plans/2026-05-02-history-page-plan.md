# History Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder History tab with a chronological audit-trail feed of expense creates and settlements.

**Architecture:** No schema changes. A new `expense.getHistory` tRPC query fans out two parallel selects (expenses + settlements, both filtered by groupId, joined to `users` for actor/receiver names), merges in JS, and returns a discriminated event array sorted newest-first. The UI renders one row per event with an icon, avatar, sentence, and relative timestamp.

**Tech Stack:** Next.js 14 App Router, tRPC, Drizzle ORM, PostgreSQL, React, Tailwind + DaisyUI.

**Spec:** [`docs/plans/2026-05-02-history-page-design.md`](./2026-05-02-history-page-design.md)

---

## File Structure

**Created:**
- `src/lib/format-date.ts` — `formatRelative(at: Date)` helper

**Modified:**
- `src/server/api/routers/expense.ts` — add `getHistory` query
- `src/app/groups/[groupId]/history/page.tsx` — replace placeholder with feed
- `scripts/screenshot.mjs` — seed one settlement so the history screenshot demos both event types

**Refreshed:**
- `screenshots/07-group-history.png`

---

## Task 1: `formatRelative` date helper

**Files:**
- Create: `src/lib/format-date.ts`

- [ ] **Step 1: Create the helper**

Write `src/lib/format-date.ts`:

```ts
/**
 * Returns a human-readable relative time string for `at`, anchored on `now`.
 * Tiers: "just now" (< 1 min), "Nm ago" (< 1h), "Nh ago" (< 24h),
 *        "yesterday" (< 48h), "Nd ago" (< 7d), "MMM d" (older).
 */
export function formatRelative(at: Date | string | number, now: Date = new Date()): string {
    const past = at instanceof Date ? at : new Date(at)
    const diffMs = now.getTime() - past.getTime()

    if (diffMs < 0) return 'just now'

    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour

    if (diffMs < minute) return 'just now'
    if (diffMs < hour) {
        const m = Math.floor(diffMs / minute)
        return `${m}m ago`
    }
    if (diffMs < day) {
        const h = Math.floor(diffMs / hour)
        return `${h}h ago`
    }
    if (diffMs < 2 * day) return 'yesterday'
    if (diffMs < 7 * day) {
        const d = Math.floor(diffMs / day)
        return `${d}d ago`
    }
    return past.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

/** ISO-like absolute timestamp suitable for tooltips. */
export function formatAbsolute(at: Date | string | number): string {
    const d = at instanceof Date ? at : new Date(at)
    return d.toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint 2>&1 | grep "format-date"`
Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/format-date.ts
git commit -m "feat: add formatRelative and formatAbsolute date helpers"
```

---

## Task 2: `expense.getHistory` tRPC query

**Files:**
- Modify: `src/server/api/routers/expense.ts`

- [ ] **Step 1: Add the query procedure**

Open `src/server/api/routers/expense.ts`. Add this procedure inside the `createTRPCRouter({ ... })` block, anywhere between existing procedures (suggested position: just after `getExpenses`):

```ts
getHistory: publicProcedure
    .input(z.object({ groupId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
        try {
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

            const events = [
                ...expenseRows.map((r) => ({ type: 'expense' as const, ...r })),
                ...settlementRows.map((r) => ({ type: 'settlement' as const, ...r })),
            ]

            events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

            return events
        } catch (error) {
            console.error('Error getting history:', error)
            throw new Error('Failed to get history')
        }
    }),
```

- [ ] **Step 2: Add the `alias` import**

At the top of `src/server/api/routers/expense.ts`, the file already imports from `drizzle-orm`. Update that import to include `alias` from the `drizzle-orm/pg-core` subpath. Add this line near the existing schema imports if not already present:

```ts
import { alias } from 'drizzle-orm/pg-core'
```

(`alias` cannot be imported from `drizzle-orm` directly — it lives in the `pg-core` submodule for Postgres.)

- [ ] **Step 3: Confirm dev server compiles**

Run in background: `npm run dev`
Wait ~10s, then read the output. Expected: `Ready in <Xms>` and no compile errors.
Kill the background server.

- [ ] **Step 4: Smoke-test the new endpoint**

While the dev server is running (restart it if you killed it), open a group with at least one expense and one settlement. Visit `/api/trpc/expense.getHistory?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22groupId%22%3A%22<paste-a-real-group-id-here>%22%7D%7D%7D` in a browser. Expected: a JSON response with both event types, newest first. Use `db:studio` to find a real groupId. Kill the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/expense.ts
git commit -m "feat(api): add expense.getHistory query"
```

---

## Task 3: History page UI

**Files:**
- Modify: `src/app/groups/[groupId]/history/page.tsx`

- [ ] **Step 1: Replace the entire file**

Replace the contents of `src/app/groups/[groupId]/history/page.tsx` with:

```tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'
import { formatRelative, formatAbsolute } from '~/lib/format-date'

const HistoryTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const { data: events, isLoading } = api.expense.getHistory.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const hasEvents = !!events && events.length > 0

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                <div className="section-title anim-fade-up d-0" style={{ marginBottom: '1.5rem' }}>History</div>

                {isLoading && (
                    <div className="card-dark anim-fade-up d-1">
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem 0' }}>Loading…</p>
                    </div>
                )}

                {!isLoading && !hasEvents && (
                    <div
                        className="card-dark anim-fade-up d-1"
                        style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}
                    >
                        <div
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border-2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.25rem',
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="8.5" stroke="var(--muted)" strokeWidth="1.25" />
                                <path d="M10 6v4.5l2.5 2.5" stroke="var(--muted)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <p className="section-sub">No activity yet.</p>
                    </div>
                )}

                {hasEvents && (
                    <div className="card-dark anim-fade-up d-1">
                        {events!.map((event, i) => {
                            const initial = event.actorName.charAt(0).toUpperCase()
                            const amount = formatAmount(parseFloat(event.amount), event.currency)
                            const relative = formatRelative(event.at)
                            const absolute = formatAbsolute(event.at)

                            return (
                                <div
                                    key={`${event.type}-${event.id}`}
                                    className={`ledger-row anim-fade-up d-${Math.min(i + 1, 8)}`}
                                    style={{ alignItems: 'center', gap: '0.625rem' }}
                                >
                                    {/* Type icon */}
                                    <div
                                        aria-hidden
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '4px',
                                            background: event.type === 'expense' ? 'rgba(242,160,7,0.12)' : 'rgba(52,211,153,0.12)',
                                            color: event.type === 'expense' ? 'var(--amber)' : 'var(--green)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {event.type === 'expense' ? '+' : '↔'}
                                    </div>

                                    {/* Avatar */}
                                    <div
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: 'var(--surface-3)',
                                            border: '1px solid var(--border-2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700,
                                            color: 'var(--dim)',
                                            textTransform: 'uppercase',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {initial}
                                    </div>

                                    {/* Description */}
                                    <div style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem', color: 'var(--body)' }}>
                                        {event.type === 'expense' ? (
                                            <>
                                                <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
                                                {' added '}
                                                <span style={{ fontStyle: 'italic' }}>&quot;{event.title}&quot;</span>{' '}
                                                <span className="font-mono" style={{ color: 'var(--amber)' }}>{amount}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
                                                {' settled '}
                                                <span className="font-mono" style={{ color: 'var(--amber)' }}>{amount}</span>
                                                {' with '}
                                                <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.receiverName}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Timestamp */}
                                    <span
                                        title={absolute}
                                        style={{ color: 'var(--muted)', fontSize: '0.75rem', flexShrink: 0 }}
                                    >
                                        {relative}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default HistoryTab
```

- [ ] **Step 2: Manually verify in the browser**

Run in background: `npm run dev`. Wait ~10s for the server to be ready. Open a group's `/history` route in a browser.

Expected:
- Title "History" at the top.
- One card listing events newest-first.
- Each row: an icon (`+` for expenses, `↔` for settlements), an avatar with the actor's initial, a sentence describing the event, and a relative timestamp on the right.
- Hovering the timestamp shows an absolute date tooltip.
- A multi-currency group renders amounts with their original currency formatting.
- A group with zero activity shows the "No activity yet" empty state.

Kill the background server.

- [ ] **Step 3: Lint check**

Run: `npm run lint 2>&1 | grep "history/page" `
Expected: no output (no errors in the changed file).

- [ ] **Step 4: Commit**

```bash
git add src/app/groups/\[groupId\]/history/page.tsx
git commit -m "feat(ui): activity feed on history page"
```

---

## Task 4: Seed a settlement in the screenshot script

**Files:**
- Modify: `scripts/screenshot.mjs`

- [ ] **Step 1: Add a settlement after expense seeding**

Open `scripts/screenshot.mjs`. The `seedTestGroup` function currently ends with:

```js
    for (const exp of expenseDefs) {
        // ...
    }

    return { groupId, users }
}
```

Insert this block immediately before `return { groupId, users }`, replacing those two lines with:

```js
    for (const exp of expenseDefs) {
        const payerIdx = Math.min(exp.payerIdx, userIds.length - 1)
        await callTRPC('expense.create', {
            groupId,
            paidByUserId: userIds[payerIdx],
            title: exp.title,
            amount: exp.amount,
            currency: exp.currency,
            category: 'General',
            splitUserIds: exp.split.filter((id) => !!id),
        })
        console.log(`   + Expense: ${exp.title} (${exp.currency} ${exp.amount})`)
    }

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

    return { groupId, users }
}
```

(In practice the only new lines are the `if (userIds.length >= 2) { ... }` block plus the surrounding context already shown — preserve the existing `for (...)` loop body byte-for-byte.)

- [ ] **Step 2: Commit the script change**

```bash
git add scripts/screenshot.mjs
git commit -m "chore(screenshot): seed a settlement to demo history"
```

---

## Task 5: Regenerate the history screenshot

**Files:**
- Refresh: `screenshots/07-group-history.png`

- [ ] **Step 1: Start the dev server in the background**

Run in background: `npm run dev`. Wait ~10 seconds and read the output to find which port it bound to (Next.js will use 3000 if free, otherwise 3001/3002/3003).

- [ ] **Step 2: Run the screenshot script**

If the dev server is on port 3000, simply run:

```bash
npm run screenshot
```

If on a different port (e.g., 3003):

```bash
BASE_URL=http://localhost:3003 npm run screenshot
```

Expected output: `✅  All screenshots saved to screenshots/`. The seeded data now includes a settlement, so `07-group-history.png` will show both expense rows and a settlement row.

- [ ] **Step 3: Visually verify the history screenshot**

Open `screenshots/07-group-history.png`. Confirm:
- Multiple rows are visible.
- At least one expense row (with `+` icon and an amount).
- At least one settlement row (with `↔` icon, a "settled with" sentence, and an amount).
- Newest event is at the top.
- Relative timestamps look right ("just now", since the seed just ran).

If the screenshot doesn't reflect both event types, re-check Task 4's edits to the screenshot script and re-run.

- [ ] **Step 4: Stop the dev server**

Use the TaskStop tool (or kill the background shell ID) to terminate the dev server.

- [ ] **Step 5: Commit**

```bash
git add screenshots/07-group-history.png
# Other screenshots may have minor pixel diffs from the regeneration; review and include
# any that show real changes from this work, but don't commit unrelated noise.
git status --short screenshots/
git commit -m "docs: regenerate history screenshot with seeded settlement"
```

---

## Final verification

- [ ] **Lint clean for changed files**

Run: `npm run lint 2>&1 | tail -25`
Expected: no NEW errors introduced in `src/lib/format-date.ts`, `src/server/api/routers/expense.ts`, or `src/app/groups/[groupId]/history/page.tsx`. Pre-existing errors elsewhere are out of scope.

- [ ] **End-to-end smoke**

In the dev app:
1. Open a group with mixed-currency expenses and at least one settlement.
2. Visit the History tab. Confirm both event types render with correct icons, names, currency formatting, and relative timestamps.
3. Open a fresh group with no activity. Confirm the empty state renders.
4. Create a new expense, return to History, confirm it appears at the top with "just now" timestamp.

- [ ] **Push and open PR**

```bash
git push -u origin feat/history-page
gh pr create --title "feat: history page with audit trail" --body "<see PR description in commit history or paste from the spec>"
```
