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

## Phase 4 — Financial System

Approved rules:
- Sales are recorded directly against LootDrop; no SaleListing in the MVP.
- Partial and repeated sales are allowed, limited by the LootDrop quantity.
- Only fully received Adena is recorded as a sale.
- Distribute independently per sale among PRESENT participants using snapshotted
  positive weights and Largest Remainder Method. Tie-break by RaidParticipant.id;
  Party share is 0%.
- Payments represent Adena actually handed over, support partial payments and
  allocate FIFO to outstanding SaleShare records.
- Ledger entries use BigInt, double-entry PARTY_CASH/MEMBER_PAYABLE accounts and
  become immutable when POSTED. JSON money values are decimal strings.
- Idempotency keys are party-scoped; same key/same parameters reuses the result,
  while same key/different parameters is a conflict.
- First posted sale locks attendance and financial LootDrop fields on the Raid.

### Phase 4.1 — Financial Schema Foundation (complete for local development)

- [x] Add PartyMember.distributionWeight with a default of 1.
- [x] Snapshot nickname and distributionWeight into every new RaidParticipant.
- [x] Add Raid.lockedAt and financial models for sales, shares, payments,
  allocations and double-entry ledger transactions/entries.
- [x] Add party/raid/member composite relations, idempotency unique constraints
  and RESTRICT delete behavior.
- [x] Add SQLite guards for positive values, oversell, sale/share and payout
  ledger balance, posted-record immutability and Raid locking.
- [x] Add a local db:sync workflow that applies Prisma schema and SQL guards.
- [x] Validate the schema and test SQLite FK, uniqueness, lock and ledger guards
  on an isolated database.
- [x] Implement sale Zod validation, party-scoped repositories and sale service.
- [ ] Add native CHECK constraints to the reviewed versioned migration; current
  disposable-db guards are triggers because Prisma db push does not represent
  CHECK constraints in schema.prisma.
- [ ] Add checked-in migration history before distributing/releasing this
  schema; Phase 4.1 was synchronized with db push by explicit approval because
  the local DB contained disposable test data.
- [x] Verify bounded retry behavior for SQLite lock/time-out failures with
  repository tests. Real multi-client contention remains a release verification.

### Phase 4.2 — Sales and Distribution

- [x] Implement idempotent partial sale registration against LootDrop.
- [x] Implement weighted Largest Remainder distribution and SaleShare snapshots.
- [x] Atomically post balanced sale ledger and lock the Raid.
- [x] Add sale history and ledger-derived member/Party balance queries.
- [ ] Test rollback, repeated idempotency requests, oversell and concurrent sales
  against a real SQLite database (unit coverage currently verifies workflow,
  idempotency, oversell and bounded lock retries).

### Phase 4.3 — Payouts and Financial UI

- [x] Implement actual member payments and FIFO PaymentAllocation.
- [x] Prevent payouts above member payable or Party cash in the service,
  transaction and SQLite posting trigger.
- [x] Add Raid sale details and ledger-derived Party/member balances.
- [x] Add payment UI, payout history snapshots and immutable posted ledger history.
- [x] Add Zod, service, repository and workflow tests for payouts.
- [x] Verify split FIFO allocation, idempotency and concurrent cash protection
  against a copied SQLite database with the actual Prisma Client.
- [ ] Add correction/compensating operations and real concurrent-sale tests.
- [ ] Run the complete check set after correction workflows are implemented.

Acceptance for Phase 4:
- Sales and payouts are atomic, idempotent and party-scoped.
- Sale shares exactly equal the received Adena amount.
- Party cash, accrued member earnings and actual payments are distinguishable.
- Posted ledger history cannot be edited or deleted.
- Financial records and original Raid snapshots remain intact.

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

Current phase: Phase 4.3 — Payouts and Financial UI (in progress).

Do not start another phase without reviewing the current one.