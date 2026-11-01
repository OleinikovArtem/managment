# Party Bank Manager

Local-first management application for a Lineage 2 farming party.

## Overview

Party Bank Manager helps manage:
- Party members.
- Dungeon raids.
- Loot drops.
- Unique item catalog.
- Item acquisition history.
- Sale listings.
- Completed sales.
- Party bank.
- Member balances and payments.

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
Local uploads and backups belong under `data/uploads/` and `data/backups/`; these
directories and the local database are excluded from Git.

Phase 1 includes the local dashboard, party name settings and member create/edit/
deactivate workflows. Raid, item, loot, sales, bank, backup/restore and SaaS
functionality remain for later phases.

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

Phase 1 — Project Foundation.

## Future Plans

The project is designed to evolve into a multi-tenant SaaS application with party owners, managers, invitations and Telegram integration.