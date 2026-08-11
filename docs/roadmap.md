# owe-wari Roadmap

A backlog of convenience features for trip/event use, ordered by natural dependency chains. Pull one item at a time; each gets its own brainstorm → spec → plan when you're ready to build it.

**Use case in scope:** short-lived trips and events (vacation, dinner, weekend away) — high-frequency bursts of expenses with the same group, often on flaky networks.

**Themes:** logging speed (A) and polish/resilience (E).

---

## Build Order

The order below is the dependency chain — each item builds on capabilities or UI surfaces introduced by earlier items. You can stop at any point and the app is still coherent.

### Chain 1 — Logging speed foundations

These are independent of each other but share a "make the create-expense flow faster" theme. Build any order; the later ones in the chain (quick-add, NL parsing) reuse drafting infrastructure that benefits from doing repeat-last first.

#### 1. Repeat-last-expense
One-tap clone of the most recent expense in the group: prefills title, amount, currency, payer, split shape, sets date to today. User confirms or tweaks then submits.

**Why:** On trips, the same kind of expense (taxi, lunch, drinks) repeats constantly. Cuts logging friction for the most common case.

**Depends on:** nothing.

#### 2. Remembered split presets
Let users name a split configuration (e.g. "everyone except kids", "just me + Nicole") and reuse it from the create-expense form via a dropdown. Stored per-group.

**Why:** Manual splits today require re-selecting the same subset over and over. Trips often have stable sub-groups (couples, parents-only, adults-only).

**Depends on:** nothing. Light schema addition (`split_presets` table).

#### 3. Smart defaults from group history
When the user types a title, suggest category and split pattern based on the most recent expense with a similar title in this group. Inline suggestion, dismissable.

**Why:** "Uber" should always be the same category and usually the same split. Removes repeated micro-decisions.

**Depends on:** Item 2 helps (presets give the suggestion something concrete to point to), but not strictly required.

#### 4. Quick-add bar with natural-language parsing
A single-line input on the expenses tab. Type `Lunch 42 sgd @nicole` → parsed into a draft expense (title, amount, currency, payer/split hint), opens the create modal pre-filled. Submit confirms.

**Why:** Fastest possible logging for users comfortable with shorthand. Lives at the top of the expenses list so it's always there.

**Depends on:** Items 1–3 ideally exist first so the parsed draft can leverage smart defaults and presets. Parser can be simple regex initially; LLM-backed later if needed.

#### 5. Receipt scan: batch mode
Open the camera once, scan N receipts in sequence without leaving. Each scan creates a draft in a queue; review and submit each at the end (or after the trip).

**Why:** Restaurant runs and shopping trips produce stacks of receipts you don't want to log one-at-a-time mid-meal.

**Depends on:** existing receipt scan infrastructure. Adds a draft-queue concept that overlaps with the offline queue from Chain 3 — worth doing after Item 9 so they share storage.

---

### Chain 2 — Find anything (search & filter)

#### 6. Search & filter on expenses tab
Filter the expenses list by free-text title, payer, category, date range, and amount range. Filters compose; URL-shareable so filtered views can be linked.

**Why:** "Where's that dinner from day 3?" becomes painful past ~30 expenses. Search is the single biggest find-it-later win.

**Depends on:** nothing. But it's a prerequisite for Item 7 (bulk actions need a way to scope what you're acting on).

#### 7. Bulk actions on filtered expenses
Multi-select from the expenses list (with filters applied), then bulk delete or bulk re-categorise. Confirmation modal shows count + total amount.

**Why:** "I categorised half the trip wrong" or "this whole day was actually paid by Nicole" needs more than per-row edits.

**Depends on:** Item 6.

---

### Chain 3 — Resilience (optimistic UI → undo → PWA)

This chain is strictly ordered. Each builds on the previous one's plumbing.

#### 8. Optimistic UI for mutations
Add/edit/delete/settle reflect in the UI immediately while the network call is in flight. On failure, the change reverts and a toast surfaces the error. Currently every mutation requires a roundtrip before the user sees anything.

**Why:** App feels instant. On flaky networks (hotel wifi, foreign data), it's the difference between "snappy" and "is this thing broken?". Also the foundation for items 9 and 10.

**Depends on:** nothing. Touches every tRPC mutation call site — substantial but mechanical.

#### 9. Undo toast for destructive actions
Delete, settle, and bulk-action mutations show a toast with "Undo" for ~5 seconds before the server call actually fires (or with a compensating action if it already did). Cancel within the window = no-op.

**Why:** Soft delete already exists for expenses but there's no UI for "I clicked the wrong row." Most-requested resilience win on competitor apps.

**Depends on:** Item 8 (the optimistic-mutation plumbing is what makes the deferred-fire pattern clean).

#### 10. Installable PWA shell
Manifest, service worker, app icon, splash screen, offline fallback page. Static assets cached for instant cold start. **Does not** include offline writes — those are deferred (see "Later" below).

**Why:** Add-to-home-screen makes the app feel native on phones (where trip logging actually happens). Cached shell means it opens instantly even on bad networks. Low-risk, high-perceived-quality.

**Depends on:** items 8 and 9 give the optimistic feel that PWA users expect; doing PWA first feels jankier.

---

## Suggested working cadence

One item per session is realistic. Pull order respects dependencies but interleaves chains so each session feels different:

1. Repeat-last-expense *(Chain 1)*
2. Remembered split presets *(Chain 1)*
3. Smart defaults from group history *(Chain 1)*
4. Quick-add bar *(Chain 1)*
5. Search & filter *(Chain 2)*
6. Optimistic UI *(Chain 3)*
7. Undo toast *(Chain 3)*
8. Receipt batch mode *(Chain 1, deferred until after #6 so it can share draft-queue plumbing)*
9. Bulk actions *(Chain 2)*
10. PWA shell *(Chain 3)*

---

## Later / Maybe (deliberately deferred)

- **Full offline-write sync.** True offline-first with conflict resolution, idempotency keys, sync indicators. This is its own multi-week project; the optimistic UI + PWA shell from Chain 3 cover ~80% of the perceived-resilience win without taking it on.
- **Recurring expenses.** Out of scope for trips/events; revisit if the use case shifts to households/roommates.
- **Comments / reactions / mentions.** Collaboration features (theme C). Different direction.
- **FX conversion to a single display currency.** Multi-currency balances are already supported per-currency; full FX conversion is a settling-clarity feature (theme B), not logging speed.
- **Export (CSV/PDF), category analytics, monthly summaries.** Insight/export theme (D).
- **Group invite links / member roles.** No auth in the app today; roles don't fit the current sharing model.

---

## Notes for future spec work

When you pull an item to actually build, brainstorm it into a proper spec — a roadmap entry is intentionally too thin to implement from. In particular:

- **Split presets** needs a schema decision (per-group vs per-user) and a UI for managing presets.
- **Quick-add NL parsing** needs a syntax decision before any code is written. Start with regex; LLM is a fallback if syntax proves too rigid.
- **Optimistic UI** needs a per-mutation policy (which queries to invalidate, how to roll back, what error UX looks like) — likely a small shared helper rather than ad-hoc per call site.
- **PWA shell** needs a service-worker strategy decision (network-first vs stale-while-revalidate per route).
