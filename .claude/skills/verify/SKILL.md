---
name: verify
description: Build, run, and drive owe-wari locally to verify changes end-to-end.
---

# Verifying owe-wari changes

## Database (no Docker needed)

Postgres 16 is at `/usr/lib/postgresql/16/bin`. It refuses to run as root — run initdb/pg_ctl via `su postgres` with a data dir postgres can write (e.g. `/tmp/pg`):

```bash
mkdir -p /tmp/pg && chown postgres:postgres /tmp/pg
su postgres -s /bin/bash -c "/usr/lib/postgresql/16/bin/initdb -D /tmp/pg/data -U postgres --auth=trust -E UTF8 && /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pg/data -l /tmp/pg/pg.log -o '-p 5432 -k /tmp/pg' start"
psql -h localhost -U postgres -c 'CREATE DATABASE "owe-wari";'
```

## Env + migrate + run

`.env` needs `POSTGRES_URL` plus dummy `ANTHROPIC_API_KEY` and `MCP_API_TOKEN` (**≥32 chars** or env validation fails). Then `npm run db:migrate` and `npm run dev`. `SKIP_ENV_VALIDATION=1` works for lint/build but not for db:migrate.

## Seeding

Tables are prefixed `owe-wari_` and need quoting in psql. Minimum viable group: a row in `owe-wari_groups`, its currency in `owe-wari_group_currencies`, users + `owe-wari_group_members`, then expenses with matching `owe-wari_expense_payments` (payer) and `owe-wari_expense_splits` (one per member) rows. IDs are 26-char strings (ULID-shaped, any 26 chars work).

## Driving

Playwright is in node_modules (`import { chromium } from 'playwright-core'`, executablePath `/opt/pw-browsers/chromium`, `--no-sandbox`). Use a mobile viewport (390×844) — this is a mobile-first app. Gotcha: on first visit a "Who are you?" identity sheet covers the page; dismiss it by clicking `I'm <member name>` before interacting. Group pages live at `/groups/<id>/expenses|balances|totals|history|settings`.
