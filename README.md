# Party Bank Manager

Local-first management application for a Lineage 2 farming party.

## Overview

Party Bank Manager helps manage:
- Party members.
- Dungeon raids and historical attendance.
- Separate loot-drop acquisition records.
- Unique item catalog.
- Item acquisition history.

Sales, party bank balances and payments are planned for a later phase.

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
npm run db:migrate:deploy
npm run dev
```

Open `http://localhost:3000`. The development and production servers bind to
`127.0.0.1`. On the first application request, a local User, Party and OWNER
membership are created in a transaction. Repeated requests reuse those records.

The SQLite database is stored at `prisma/dev.db`. Normal application startup does
not run migrations, reset or recreate the database. Use `npm run db:migrate` to
create a development migration, and `npm run db:migrate:deploy` to apply checked-in
migrations. Back up the database before applying schema changes to valuable data.
The local database and backups belong under `prisma/` and `data/backups/` and are
excluded from Git. Screenshot uploads are not implemented yet; when added, files
must remain outside the public static directory.

Phase 1 provides the local dashboard, party settings and member workflows. Phase 2
adds the party-scoped item catalog with normalized duplicate protection, search,
category filtering and item details. Phase 3 adds party-scoped raid creation,
editing and history; an attendance snapshot of the active roster; separate
LootDrop records; and acquisition history on item details.

Raid creation, its complete attendance snapshot and submitted loot records are
written in one database transaction. Attendance edits update the original rows;
the roster cannot be replaced. Historical records have no hard-delete UI or
server action, and SQLite restricts deleting referenced raids, members and items.
Raid times are entered in the browser's local time zone, converted to UTC for
storage and rendered back in the browser's local time zone. Nonexistent or
ambiguous local times during daylight-saving transitions are rejected.

Screenshot path fields are reserved, but screenshot uploads/storage are not
implemented. Sales, bank, backup/restore workflows and SaaS functionality remain
for later phases.

Useful checks:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Documentation

- `PROJECT_SPEC.md` — product requirements and architecture.
- `DEVELOPMENT_PLAN.md` — implementation roadmap.
- `COPILOT_INSTRUCTIONS.md` — GitHub Copilot development rules.

## Project Status

Phase 3 — Raids and Loot.

## Future Plans

The project is designed to evolve into a multi-tenant SaaS application with party owners, managers, invitations and Telegram integration.