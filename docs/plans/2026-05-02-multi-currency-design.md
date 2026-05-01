# Multi-Currency Support — Design

## Goal

Let a group track expenses in multiple currencies without forcing exchange-rate accounting. Each expense, balance, and settlement is denominated in a specific currency; FX conversion only happens at settle-up time as a UX aid for "how much should I actually transfer right now," and is not persisted.

## Scope

- Group creation: select which currencies the group will use (multi-select). SGD is always included and marked as the default.
- Expense creation: pick a currency per expense from the group's enabled set.
- Expense list & detail: show each amount with its own currency.
- Balances page: per-currency balances and per-currency simplified transfers.
- Settle-up: when a pair has debts in multiple currencies, prompt for editable FX rates and show a single "amount to transfer" total in the group's default currency.

Out of scope (explicitly):
- Adding/removing currencies after group creation (settings page untouched for currencies).
- Changing the group's default currency post-creation.
- Persisting FX rates anywhere in the database.
- Any external FX rate API.

## Data model changes

### New table: `group_currencies`

```ts
groupCurrencies: {
  id: serial primary key,
  groupId: varchar(26) references groups.id,
  code: varchar(3) not null,
  createdAt, updatedAt
}
// unique (groupId, code)
```

Stores which currencies a group uses. The group's default currency (`groups.currency`) must always be present in this table for the group.

### Existing table changes

- `groups.currency` — **kept as-is**. Acts as the group's default/base currency. A row in `group_currencies` for `(groupId, groups.currency)` is inserted on group creation alongside any others the user picked.
- `expenses.currency` — **new column**, `varchar(3) not null`. Backfilled on migration to the parent group's `currency`.
- `settlements.currency` — **new column**, `varchar(3) not null`. Backfilled on migration to the parent group's `currency`.

### Migration

A single Drizzle migration:
1. Create `owe-wari_group_currencies`.
2. Add `currency` to `expenses` (nullable initially → backfill from groups → set NOT NULL).
3. Add `currency` to `settlements` (same pattern).
4. Backfill `group_currencies` with one row per group using `groups.currency`.

## Backend (tRPC)

### `group.create` — modified

- Input gains `currencies: string[]` (must include `defaultCurrency`) and `defaultCurrency: string`.
- Persists `groups.currency = defaultCurrency`, then inserts one `group_currencies` row per code in `currencies`.

### `group.getCurrencies` — new

- Input: `{ groupId }`. Returns `{ code, isDefault }[]`. Used by expense form and settle-up flow.

### `expense.create` — modified

- Input gains `currency: string`. Validate it's in `group_currencies` for the group; otherwise reject with a tRPC error.

### `expense.getExpenses` & `expense.getExpense` — modified

- Returned rows include `currency`.

### `expense.getTotalExpenseCost` — modified

- Returns the total only for expenses in the group's default currency. Plus a `otherCurrencyCount: number` so the summary card can show "+ N expenses in other currencies".

### `expense.getBalances` — modified

- Return shape becomes `{ userId, name, balances: { currency, netBalance }[] }[]`.
- Internally: aggregate paid + owed + settlements grouped by `(userId, currency)`. Currencies with `|net| < 0.005` for a user are filtered out.

### `expense.settleUp` — modified

- Input becomes `{ groupId, payerId, receiverId, lines: { currency, amount }[] }`.
- Validates each `currency` is in `group_currencies`, and `amount > 0`.
- Inserts one settlement row per line, each with its own currency.
- Returns `{ success: true }`.
- Single tRPC call records the whole settle-up event atomically (wrapped in a transaction).

## Debt simplification

`simplifyDebts(balances: Balance[])` is called **per currency**. The balances page groups by currency, runs `simplifyDebts` independently for each, and renders a section per currency.

No change to `simplifyDebts` itself — it stays single-currency by contract.

## Frontend changes

### Group creation (`src/app/_components/create-group.tsx`)

Replace the currency `<select>` with a checkbox grid of supported currency codes:

```
Currencies *
┌─────────────────────────────────────────┐
│  [✓] SGD (default)   [ ] USD   [ ] AUD  │
│  [ ] EUR   [ ] JPY   [ ] KRW            │
│  [ ] MYR   [ ] IDR   [ ] VND            │
└─────────────────────────────────────────┘
```

- SGD is always checked and disabled (cannot be unchecked).
- Suffix `(default)` next to SGD.
- Form state: `currencies: string[]` initialized to `['SGD']`.
- Submit sends `{ currencies, defaultCurrency: 'SGD' }`.

### Expense creation (`src/app/_components/create-expense.tsx`)

Add a `Currency` `<select>` next to the amount input. Options come from `group.getCurrencies`. Defaults to the group's default currency. Form state: `currency: string`.

### Expense list / detail

`formatAmount(amount, currency)` helper in `src/lib/format-currency.ts` — renders `$50.00 SGD`, `¥3,000 JPY`, etc. Used in:
- `src/app/groups/[groupId]/expenses/page.tsx` (rows)
- `ExpenseDetailModal` (header amount and split rows)
- `src/app/groups/[groupId]/history/page.tsx` (settlement and expense rows)

### Summary page (`src/app/groups/[groupId]/summary/page.tsx`)

- "Total spent" card shows the total in the group's default currency only. Below it, a small line: `+ N expenses in other currencies` (only if `otherCurrencyCount > 0`).
- "Outstanding" card shows the total absolute outstanding in the default currency only (since balances are now per-currency, this is `sum(|netBalance|)` only for `currency === default`). Likewise show a small hint for other currencies.
- Member Balances card: each member row gets one sub-line per currency they have a non-zero balance in.

### Balances page

Currently one list. Change to one section per currency, each section running `simplifyDebts` on that currency's balances independently.

```
SGD
  Alice → Bob: $50.00
  Charlie → Bob: $20.00

JPY
  Alice → Bob: ¥3,000
```

### Settle-up flow

In the existing settle-up UI for a pair `(payer, receiver)`:

- Fetch `getBalances` and filter to currencies where the payer owes the receiver.
- Render one row per currency:
  - For the default currency: just `$50.00 SGD` (no rate UI).
  - For others: `¥3,000 JPY × [0.00909] = $27.27 SGD` — the rate is an editable number input.
- Default rates come from a hardcoded table in `src/lib/fx-rates.ts`:
  ```ts
  export const DEFAULT_RATES: Record<string, Record<string, number>> = {
    SGD: { USD: 0.74, JPY: 110, EUR: 0.69, AUD: 1.13, KRW: 1020, MYR: 3.5, IDR: 12000, VND: 18500 },
  }
  // Inverse looked up dynamically.
  ```
  For an unknown pair, default to `1.0` and let the user fix it.
- "Total to pay" line shows the sum in the group's default currency.
- Confirm button calls `expense.settleUp` with one line per currency, each in its **original** currency and amount (not the converted amount). The rate is purely a display aid for the user to know what to actually transfer.
- If the payer only owes in the default currency, the rate UI is hidden — flow degrades to today's behavior.

## Defaults and constants

`src/lib/currencies.ts`:
```ts
export const SUPPORTED_CURRENCIES = ['SGD','USD','AUD','EUR','JPY','KRW','MYR','IDR','VND'] as const
export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  SGD: '$', USD: '$', AUD: '$', EUR: '€', JPY: '¥', KRW: '₩',
  MYR: 'RM', IDR: 'Rp', VND: '₫',
}
export const ZERO_DECIMAL_CURRENCIES = new Set(['JPY','KRW','VND','IDR'])
```

`formatAmount(amount, code)` uses `Intl.NumberFormat` with `style: 'currency', currency: code`, falling back to the symbol map. For zero-decimal currencies, no decimals are shown.

## Validation rules

- A group must have at least one currency (the default).
- Every expense's currency must be in its group's `group_currencies`.
- Every settlement's currency must be in its group's `group_currencies`.
- The group's default currency cannot be removed from `group_currencies` (enforced at the input level since group settings doesn't expose currency editing in this scope).

## Non-goals / edge cases left for later

- Editing the group's currency list after creation (probably a later task in the settings page).
- Per-user preferred currency / display preferences.
- Persisting historical FX rates for audit.
- Multi-currency split logic within a single expense (e.g., "$50 SGD split across these people in their preferred currencies"). Each expense remains single-currency.

## Verification

1. Create a new group with SGD + JPY enabled. Confirm the chip grid behavior (SGD locked, others toggleable).
2. Create one SGD expense and one JPY expense. Confirm both display with correct symbols and decimal handling on the expenses list.
3. Open the balances page. Confirm two sections (SGD and JPY) with independent simplified transfers.
4. Trigger settle-up between two members who owe in both currencies. Confirm the rate is editable, the total updates live, and confirming records both balances as cleared.
5. Reload the balances page after settle-up — the pair should be settled in both currencies.
6. Open the summary page. Confirm "Total spent" shows the default-currency total plus the "+ N expenses in other currencies" hint when applicable.
7. Create a pre-migration group manually (or simulate by setting expenses.currency to NULL on a row) — backfill must populate it from the group's default.
8. `npm run lint` clean for changed files.
9. Run `npm run screenshot` and update the affected screenshots in the repo:
   - `03-create-group.png` — currency multi-select grid
   - `04-group-summary.png` — totals + "other currencies" hint
   - `05-group-expenses.png` — per-row currency labels
   - `06-group-balances.png` — per-currency sections
   - `07-group-history.png` — settlement currency labels
   - `09-create-expense.png` — currency dropdown
   Commit the regenerated images alongside the implementation.
