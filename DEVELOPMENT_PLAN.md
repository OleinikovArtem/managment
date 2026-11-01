# Party Bank Manager — Development Plan

## Development Rules

- Implement one phase at a time.
- Do not start the next phase until the current one is reviewed.
- Keep TypeScript strict.
- Run lint and tests after meaningful changes.
- Use Prisma migrations.
- Do not use mock data as production data.
- Never silently delete user data.
- Update this document when a task is completed.

## Phase 1 — Project Foundation

- [x] Initialize Next.js with TypeScript.
- [x] Configure Tailwind CSS.
- [x] Configure shadcn/ui.
- [x] Install and configure Prisma.
- [x] Configure SQLite.
- [x] Create initial Prisma schema.
- [x] Create local User and Party initialization.
- [x] Implement repository/service structure.
- [x] Create dashboard layout.
- [x] Create sidebar navigation.
- [x] Implement Party settings.
- [x] Implement PartyMember CRUD.
- [x] Add validation.
- [x] Add empty/loading/error states.

Acceptance:
- Application starts locally.
- Database persists.
- Local party is initialized.
- Members can be created, edited and deactivated.

## Phase 2 — Item Catalog

- [x] Implement Item model.
- [x] Implement item creation.
- [x] Implement item editing.
- [x] Implement item search.
- [x] Implement duplicate detection.
- [x] Implement item list.
- [x] Implement item details.
- [x] Show an empty acquisition-history state until Raid/LootDrop exists.
- [x] Display acquisition history after LootDrop is implemented.
- [ ] Display sales history.
- [x] Add tests for item uniqueness and search.

Acceptance:
- Each unique item exists once in the party catalog.
- Existing items can be selected again.
- Multiple acquisitions are stored separately.

## Phase 3 — Raids and Loot

- [x] Implement party-scoped Raid list, create, edit and details (no hard delete).
- [x] Snapshot every active PartyMember as PRESENT or ABSENT with nicknameSnapshot.
- [x] Require at least one PRESENT member and preserve snapshot rows during edits.
- [x] Create the raid, attendance snapshot and loot entries in one transaction.
- [x] Implement party-scoped LootDrop creation and editing; repeated Item drops stay separate.
- [x] Enforce party consistency with compound foreign keys and RESTRICT deletion.
- [x] Validate positive integer quantities in Zod and the service.
- [x] Display LootDrop acquisition history on Item details.
- [x] Convert browser-local raid times to UTC for storage and display them locally.
- [x] Add schema, service, repository and date conversion tests.
- [ ] Implement screenshot uploads (deferred; only nullable path fields are reserved).

Acceptance:
- Raids can be created, viewed and edited without a hard-delete workflow.
- Every active party member is represented in the immutable roster snapshot.
- Attendance status changes update existing snapshot rows only.
- Loot entries reference party-owned catalog items and retain separate acquisition records.
- Invalid quantities and cross-party references are rejected.
- Local input time is stored in UTC and rendered in the browser's local time zone.
- Screenshot file storage remains out of scope for this phase.

## Phase 4 — Sales and Bank

- [ ] Implement SaleListing.
- [ ] Implement manual sale registration.
- [ ] Implement partial sales.
- [ ] Implement SaleTransaction.
- [ ] Implement SaleShare.
- [ ] Implement LedgerEntry.
- [ ] Implement equal distribution.
- [ ] Implement remainder handling.
- [ ] Implement member balances.
- [ ] Implement manual payments.
- [ ] Implement financial history.
- [ ] Add financial calculation tests.

Acceptance:
- Sales can be registered.
- Shares are calculated correctly.
- Member balances are correct.
- Payments are recorded independently.
- Financial history is preserved.

## Phase 5 — Backup and Polish

- [ ] Implement database backup.
- [ ] Include screenshots in backups.
- [ ] Implement backup validation.
- [ ] Implement restore.
- [ ] Implement CSV export.
- [ ] Improve dashboard statistics.
- [ ] Improve responsive UI.
- [ ] Add final tests.
- [ ] Update README.

Acceptance:
- Full local data can be backed up and restored.
- Core workflows work without external services.

## Future Phase — SaaS

Not part of the MVP.

- [ ] User registration.
- [ ] PostgreSQL migration.
- [ ] Multi-party support.
- [ ] OWNER and MANAGER roles.
- [ ] Party invitations.
- [ ] Cloud screenshot storage.
- [ ] Telegram webhook integration.
- [ ] Automatic sale recognition.
- [ ] OCR screenshot processing.

## Current Status

Current phase: Phase 3 — Raids and Loot.

Do not start another phase without reviewing the current one.