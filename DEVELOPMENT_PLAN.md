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
- Record full or partial Adena actually handed to a member; show total share,
  amount already handed over, and remaining amount in plain language.
- Track the remaining total in the shared Party bank.
- No returns, refunds, reversals, fees, manual adjustments or accounting UI are
  part of the product scope.
- An immutable internal ledger currently protects balances and payment history;
  its technical entries are not shown to users.
- Idempotency keys are party-scoped; same key/same parameters reuses the result,
  while same key/different parameters is a conflict.
- First recorded sale locks attendance and financial LootDrop fields on the Raid.

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
- [x] Verify repeated idempotency requests, oversell protection and concurrent
  sales against a copied SQLite database using the actual Prisma Client.

### Phase 4.3 — Member Payments and Simple Finance UI

- [x] Record full or partial Adena payments to members; internal allocation
  links payments to unpaid sale shares.
- [x] Prevent payments above a member's remaining share or the Party bank.
- [x] Add Raid sale details and Party/member balances from recorded sales and
  payments.
- [x] Add payment UI, payment history and member nickname snapshots.
- [x] Add a Party-scoped chronological history of sales and payments.
- [x] Keep accounting entries and allocation mechanics out of the user-facing
  finance screens.
- [x] Use plain sales, participant shares and transfer amounts in the CSV export;
  keep the ledger as an internal implementation detail.
- [x] Add Zod, service, repository and workflow tests for payouts.
- [x] Verify split FIFO allocation, idempotency and concurrent cash protection
  against a copied SQLite database with the actual Prisma Client.
- [x] Run lint, typecheck, all tests, Prisma validation and production build.
- [x] Smoke-test the sales and financial-history pages.
- [x] Keep returns, refunds, reversals, fees and accounting workflows outside
  the MVP.

Acceptance for Phase 4:
- Sales and payouts are atomic, idempotent and party-scoped.
- Sale shares exactly equal the received Adena amount.
- The shared Party bank and each member's remaining amount are easy to see.
- Each sale shows which participants receive a share and how much.
- Each payment shows who received Adena, how much and when.
- Financial records and original Raid snapshots remain intact.

## Phase 5 — Backup and Polish

- [x] Create a local ZIP backup using a consistent SQLite snapshot.
- [x] Include existing files under `data/uploads/` in backups.
- [x] Add a versioned manifest and SHA-256 checks for archive contents.
- [x] Validate archive paths, sizes, SQLite integrity, foreign keys and required
  financial triggers.
- [x] Prepare and verify a restore candidate in a separate directory without
  replacing the active database.
- [ ] Implement user-facing upload/storage for screenshots.
- [ ] Implement a reviewed workflow to activate a restore candidate and restore
  its uploads; current preparation is deliberately non-destructive.
- [x] Export Party sales, participant shares and member payments as a simple CSV.
- [ ] Improve dashboard statistics.
- [ ] Improve responsive UI.
- [x] Add isolated integration tests for backup, validation and restore staging.
- [x] Update README to document backup and restore-candidate behavior.
- [ ] Add final tests for the remaining Phase 5 features.

Acceptance:
- Local database and existing uploads can be backed up and integrity-checked.
- Restore preparation does not replace active data.
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

Current status: Phase 5 local backup, validation, non-destructive
restore-candidate preparation and simple sales/payment CSV export implemented.
The finance UI focuses on sale shares, member payments and the shared bank; the
ledger remains internal. Screenshot upload UI, automatic restore activation and
remaining polish are pending. Returns and accounting workflows are out of scope.
A versioned database migration/release workflow remains a separate future task.

Do not start another phase without reviewing the current one.