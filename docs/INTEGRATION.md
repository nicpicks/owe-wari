# Jiogo integration

owe-wari pairs with [Jiogo](https://jiogo.vercel.app) (trip itinerary planner). The two apps
are deployed separately and stay loosely coupled: each side stores a URL pointing at the
other, and deep-links across.

## How the link works

- `groups.trip_url` stores the itinerary URL for a group (any http(s) URL — typically a
  Jiogo trip share link). Set/cleared via `group.updateTripLink`; surfaced by `group.getGroup`.
- When set, the group header shows an **Itinerary ↗** link on every tab, and the settings
  page has a **Trip Itinerary** card to edit or unlink it.
- On the Jiogo side, a trip stores `expenseGroupUrl` pointing back at the owe-wari group.

## `POST /api/integration/group-from-trip`

Public, CORS-enabled endpoint that lets a trip planner create a pre-linked expense group in
one call. Jiogo calls this (server-side) from its "Create expense group" button.

### Request

```json
{
    "name": "Tokyo 2026",
    "description": "optional, ≤256 chars",
    "memberNames": ["Alice", "Bob"],
    "currency": "SGD",
    "currencies": ["SGD", "JPY"],
    "tripUrl": "https://jiogo.vercel.app/trips/<shareToken>"
}
```

- `memberNames` (1–50) become the group members.
- `currency` defaults to `SGD`; `currencies` is optional — the default currency is always
  included. All codes must be in `SUPPORTED_CURRENCIES` (`src/lib/currencies.ts`).
- `tripUrl` is stored on the group so it links back to the itinerary.

### Response

`201` with:

```json
{ "groupId": "01J…", "url": "https://www.owe-wari.com/groups/01J…" }
```

`400` for validation errors, `500` on failure.

### Security model

Same as the rest of the app: no auth, the group ULID in the returned URL is the only
capability. This endpoint is a thin wrapper over the already-public `group.create` tRPC
mutation, so it does not widen the attack surface.
