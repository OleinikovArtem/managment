# Party Bank Manager

Local-first management application for a Lineage 2 farming party.

## Overview

Party Bank Manager helps manage:
- Party members.
- Dungeon raids and historical attendance.
- Separate loot-drop acquisition records.
- Unique item catalog.
- Item acquisition history.
- Received sales, weighted member shares, Party cash and outstanding member balances.

The financial workflow is intentionally simple: record sold items, see each
participant's share, record Adena handed to members, and track the shared Party
bank. Returns, refunds and accounting workflows are not part of the product.

## Technology

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- SQLite

## Local Development

Requirements:
- Node.js 22.12+ or 24+
- npm
- Visual Studio Code

Setup from the project directory (PowerShell):

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run db:generate
npm run db:sync
npm run dev
```

Open `http://localhost:3000`. The development and production servers bind to
`127.0.0.1`. On the first application request, a local User, Party and OWNER
membership are created in a transaction. Repeated requests reuse those records.
The checked-in [High Five item dump](./prisma/seeds/lineage2-high-five-items.json)
contains 130 curated names across armor, weapons, materials, skill books and
enchant scrolls. During workspace initialization,
missing names are restored idempotently for the local Party, and legacy group
labels are migrated to structured classifications once. Later edits to an
item's classification and Rare status are preserved. The JSON source remains
in Git if the development database is cleared. After recreating the schema with
`npm run db:sync`, the first application request recreates the local workspace
and restores the catalog. Catalog entries show separate item group, grade, item
type, variant (for example armor type) and Rare status. The dump contains
curated item names rather than a full game database.

The SQLite database is stored at `prisma/dev.db`. Application requests do not
reset or recreate the database; workspace initialization only restores missing
names from the checked-in base item dump without overwriting existing catalog
entries. `npm run db:sync` uses Prisma `db push` and
then installs SQLite integrity triggers from
[`prisma/financial-constraints.sql`](./prisma/financial-constraints.sql). This is
a local development workflow, not a versioned migration, and should only be used
with a disposable development database. The Phase 4 schema has not been added to
Prisma migration history; `prisma migrate status` does not certify this schema,
and `db:migrate:deploy` must not be used on a database initialized with `db:sync`.
A reviewed migration path is required before distributing or releasing Phase 4.
Back up valuable data before any schema change. The local database and backups
belong under `prisma/` and `data/backups/` and are excluded from Git. Screenshot
uploads are not implemented in the UI yet; existing files under `data/uploads/`
are included in local backups and remain outside the public static directory.

Phase 1 provides the local dashboard, party settings and member workflows. Phase 2
adds the party-scoped item catalog with normalized duplicate protection,
debounced live search, server-side pagination, category filtering, structured
item classification and item details. Phase 3 adds party-scoped raid creation,
editing and history; an attendance snapshot of the active roster; separate
LootDrop records; and acquisition history on item details.

Raid creation, its complete attendance snapshot and submitted loot records are
written in one database transaction. Loot records select existing catalog
items; create new items in the item catalog before adding them to a raid.
Attendance edits update the original rows;
the roster cannot be replaced. Historical records have no hard-delete UI or
server action, and SQLite restricts deleting referenced raids, members and items.
Raid times are entered in the browser's local time zone, converted to UTC for
storage and rendered back in the browser's local time zone. Nonexistent or
ambiguous local times during daylight-saving transitions are rejected.

Screenshot path fields are reserved, but screenshot uploads/storage are not
implemented in the UI. Phase 4.2 records partial or repeated LootDrop sales only
after Adena is received, distributes each sale among PRESENT participants using
the Raid's snapshotted weights, and updates the Party bank and member balances.
Raid attendance and loot become locked after its first sale.
Partial payments update the remaining amount for each participant. An immutable
internal record is used to calculate balances, but the interface shows sales,
participant shares and payments rather than accounting entries.

Phase 5 provides local ZIP backups of a consistent SQLite snapshot and files in
`data/uploads/`, with a SHA-256 manifest, archive/path limits, SQLite integrity
and foreign-key checks, and validation of required financial triggers. The
settings page can validate backups and prepare a restore candidate under
`data/restore-candidates/`. Preparation never replaces the active database.
Switching `DATABASE_URL` and restoring candidate uploads are manual steps after
stopping the application; preserve the current database and uploads before doing
so. The sales-and-payments history page exports sales, participant shares and
payments as UTF-8 CSV with exact Adena integer strings.
Upload UI, automatic restore activation and remaining polish are not implemented
yet. SaaS functionality remains a future plan.

Useful checks:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Documentation

- [docs/PROJECT_CONTEXT.md](./docs/PROJECT_CONTEXT.md) — compact implementation map and development context.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — current data flows, financial invariants and operational limitations.
- [docs/UI_UX_AUDIT.md](./docs/UI_UX_AUDIT.md) — evidence-backed UI/UX audit and prioritized redesign brief.

- `PROJECT_SPEC.md` — product requirements and architecture.
- `DEVELOPMENT_PLAN.md` — implementation roadmap.
- `COPILOT_INSTRUCTIONS.md` — GitHub Copilot development rules.

## Project Status

Phase 5 — Local backups, validation, restore-candidate preparation and financial
history CSV export (implemented; automatic activation and remaining polish are
pending).

## Future Plans

The project is designed to evolve into a multi-tenant SaaS application with party owners, managers, invitations and Telegram integration.
