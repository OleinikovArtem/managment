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
- [ ] Display acquisition history after LootDrop is implemented.
- [ ] Display sales history.
- [x] Add tests for item uniqueness and search.

Acceptance:
- Each unique item exists once in the party catalog.
- Existing items can be selected again.
- Multiple acquisitions are stored separately.

## Phase 3 — Raids and Loot

- [ ] Implement Raid CRUD.
- [ ] Implement participant selection.
- [ ] Implement raid details.
- [ ] Implement LootDrop model and CRUD.
- [ ] Connect loot to Item.
- [ ] Connect loot to Raid.
- [ ] Implement local screenshot uploads.
- [ ] Add raid history.
- [ ] Add tests for raid participants and loot history.

Acceptance:
- Raids can be created.
- Actual participants can be selected.
- Multiple loot entries can be added.
- Existing catalog items can be reused.
- Screenshots persist locally.

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

Current phase: Phase 2 — Item Catalog.

Do not start another phase without reviewing the current one.