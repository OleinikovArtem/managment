# Party Bank Manager — Project Specification

## 1. Project Overview

Build a local-first web application for managing a Lineage 2 farming party.

The application helps an administrator manage:
- Permanent party members.
- Dungeon raids and actual participants.
- Loot drops.
- A reusable catalog of unique Lineage 2 items.
- Item acquisition history.
- Sale listings and completed sales.
- Party bank and player balances.
- Payments and financial history.

The first release must run entirely locally on one computer.

No external services, cloud deployment, online registration or paid infrastructure are required for the MVP.

## 2. Future Product Vision

The architecture must support future SaaS development.

Future functionality:
- User registration.
- Multiple independent parties.
- Party owners (OWNER).
- Invited managers (MANAGER).
- Role-based access control.
- Party invitations.
- Independent party data and financial history.
- Cloud database and storage.

Do not implement these features in the first release. Only prepare the architecture.

## 3. Technology Stack

- Next.js (App Router)
- React
- TypeScript (strict mode)
- Tailwind CSS
- shadcn/ui
- Prisma ORM
- SQLite
- Zod
- React Hook Form
- Lucide icons

Local file storage for screenshots.

No Supabase, Docker, Telegram API, cloud storage or external authentication in MVP.

## 4. Local Application

Requirements:
- Start with `npm run dev`.
- Open `http://localhost:3000`.
- Persist data between restarts.
- Use a local SQLite database.
- Store screenshots locally.
- Support database and screenshot backups.
- Work without external services after dependencies are installed.

Suggested paths:

prisma/dev.db
data/uploads/
data/backups/

Do not expose private uploaded screenshots through a public static directory.

## 5. Multi-Tenant Architecture

Design the database with future multi-tenancy in mind.

Important entities:

- User: person using the application.
- Party: independent workspace.
- PartyMember: Lineage 2 character.
- PartyMembership: user's access to a party.
- PartyInvitation: future invitation mechanism.

Future roles:
- OWNER
- MANAGER

For MVP:
- One local User.
- One local Party.
- One local OWNER.
- No online registration.
- No invitations.
- No multi-user authentication.

All party-specific business entities must have partyId.

All database queries must be scoped to the active party.

Never hardcode the party ID throughout the application.

## 6. Database Models

### User
- id
- email (optional in local mode)
- displayName
- createdAt

### Party
- id
- name
- ownerId
- createdAt
- updatedAt

### PartyMembership
- id
- partyId
- userId
- role
- createdAt

### PartyInvitation
- id
- partyId
- email
- role
- token
- expiresAt
- acceptedAt
- createdAt

Invitation functionality is not implemented in MVP.

### PartyMember

Represents an in-game character, not an application user.

Fields:
- id
- partyId
- nickname
- isActive
- distributionWeight (positive integer, default 1)
- comment
- createdAt
- updatedAt

Nickname must be unique within a party.

Never delete members with historical records.

### Item

Reusable catalog of unique items.

Fields:
- id
- partyId
- canonicalName
- normalizedName
- displayName (optional)
- category (optional)
- gameVersion (optional)
- comment (optional)
- createdAt
- updatedAt

Requirements:
- One catalog record per unique item within a party.
- Preserve original Lineage 2 item names.
- Use normalizedName for searching and duplicate detection.
- Normalize whitespace and perform case-insensitive matching.
- Never silently modify canonicalName.
- Allow adding items directly from the loot form.
- Prevent accidental duplicates.

### Raid

Fields:
- id
- partyId
- name
- instanceName
- date
- screenshotPath (optional)
- comment (optional)
- lockedAt (optional; set on the first posted sale)
- createdAt
- updatedAt

### RaidParticipant

Fields:
- id
- partyId
- raidId
- memberId
- nicknameSnapshot
- status (PRESENT or ABSENT)
- distributionWeight snapshot

Unique constraint: partyId + raidId + memberId.

Store actual participants independently for every raid.
The distribution weight and nickname used by a sale come from this historical
snapshot, never from the current party roster.

### LootDrop

Represents one occurrence of an item obtained during a raid.

Fields:
- id
- partyId
- raidId
- itemId
- quantity
- screenshotPath (optional)
- status
- comment
- createdAt
- updatedAt

Statuses:
- RECEIVED

Multiple LootDrop records can reference the same Item.

Never create a new Item just because an existing item drops again.

Sales are recorded directly against a LootDrop. Sale listings and asking-price
workflows are not part of the approved financial MVP.

### SaleTransaction

Fields:
- id
- partyId
- raidId
- lootDropId
- quantitySold
- totalPrice (BigInt Adena)
- receivedAt
- idempotencyKey (unique within a party)
- distributionMethod
- algorithmVersion
- createdAt

The recorded price is Adena actually received. A LootDrop can have multiple
partial or repeat sales, but cumulative sold quantity cannot exceed its quantity.
Each transaction is distributed independently.

### SaleShare

Fields:
- id
- partyId
- raidId
- saleTransactionId
- raidParticipantId
- memberId
- nicknameSnapshot
- weightSnapshot
- distributionMethod
- algorithmVersion
- amount (BigInt Adena)

Store the calculated share for each PRESENT RaidParticipant. Composite foreign
keys must enforce matching party, raid, sale and participant.

### MemberPayment and PaymentAllocation

MemberPayment records Adena actually paid to one PartyMember, including the
member nickname snapshot, paidAt, comment and party-scoped idempotency key.
PaymentAllocation links each payment to one or more SaleShare records and
preserves the amount applied to each outstanding share.

Partial and multiple payments are supported. Allocate payments FIFO to the
member's oldest outstanding SaleShare. The member's current active status or
nickname does not alter historical payment records.

### LedgerTransaction and LedgerEntry

LedgerTransaction has a DRAFT or POSTED status and exactly one source: a
SaleTransaction or MemberPayment. LedgerEntry uses the PARTY_CASH and
MEMBER_PAYABLE accounts with separate debit and credit BigInt Adena values.

DRAFT entries may be edited or deleted. Posting requires balanced entries and
matching sale shares or payment allocations. POSTED transactions and entries are
immutable; corrections, refunds and manual adjustments are outside the approved
MVP.

Use Prisma BigInt for monetary values and decimal strings over JSON. Never use
floating-point arithmetic for financial calculations.

## 7. Item Catalog and Loot History

This is a core feature.

Create a dedicated Items page.

Features:
- Browse all known items.
- Search by original item name.
- Filter by category.
- Create new items.
- Edit item metadata.
- View item details.
- View acquisition history.
- View all associated raids.
- View all sales.
- View average sale price.
- View latest sale price.
- View total quantity obtained.
- View total quantity sold.

Item details must show every LootDrop associated with the item.

Example:

Dynasty Earring

Acquisition history:
- Raid #12 — 12 October — 1 item.
- Raid #16 — 18 October — 1 item.
- Raid #21 — 25 October — 2 items.

Each acquisition record retains its own raid participants and sale history.

## 8. Raid Management

Implement:
- Create raid.
- Select instance.
- Select date.
- Select actual participants.
- Attach screenshot.
- Add comments.
- Edit raid.
- View raid details.

Raid details must contain:
- Raid information.
- Participants.
- Loot list.
- Total actual sale value.
- Sale history.
- Screenshots.

When adding loot:
1. Search the existing item catalog.
2. Select an existing item.
3. If no match exists, allow creating a new item.
4. Specify quantity.
5. Attach optional screenshot.
6. Save LootDrop linked to the raid.

Support multiple items per raid.

## 9. Sales Management

Implement direct sale recording from a LootDrop.

- A sale can cover part or all of the remaining LootDrop quantity.
- Multiple transactions can record subsequent sales of the same LootDrop.
- Record only a sale for which the full Adena amount has been received.
- Use an idempotency key to prevent duplicate operations.
- Link each transaction to its original LootDrop, Raid and Item.
- Do not create SaleListing or asking-price workflows in this MVP.

A sale must use participants of its originating raid.

Never use the current party roster for historical distribution.

## 10. Financial Management

Distribute each sale among PRESENT participants of the originating Raid, using
the RaidParticipant weight and nickname snapshots. ABSENT participants receive
no share. The current PartyMember roster must never be used to calculate a
historical sale.

Use weighted integer distribution with the Largest Remainder Method. Break equal
remainder ties deterministically by RaidParticipant.id. Each sale is calculated
independently, and the total of all SaleShare amounts must equal totalPrice
exactly. The Party's share of a sale is 0%.

Keep separate:
- Party cash.
- Member accrued earnings (outstanding payable).
- Member actual payments.
- Remaining member balances.

Post a sale and its shares and ledger entries atomically. The first posted sale
sets Raid.lockedAt in the same transaction; afterward attendance and financial
LootDrop fields cannot change. Explanatory comments remain editable.

Post a payout and its FIFO allocations and ledger entries atomically. A payout
cannot exceed the member's outstanding earnings or available Party cash.

Every posted sale creates a SaleTransaction, SaleShare records and balanced
double-entry ledger records. Every payout creates a MemberPayment,
PaymentAllocation records and balanced ledger records.

Never edit or delete posted financial history. Refunds, reversals, adjustments,
fees and other compensating operations are outside the approved MVP.

## 11. Application Pages

/dashboard
- Total party bank.
- Sales statistics.
- Unsold loot.
- Active members.
- Recent raids.
- Recent sales.

/members
/members/[id]
- Party roster.
- Individual balances.
- Raid history.

/items
/items/[id]
- Item catalog.
- Search.
- Acquisition history.
- Sales history.

/raids
/raids/new
/raids/[id]
- Raid management.
- Participants.
- Loot.
- Screenshots.

/sales
/sales/[id]
- Sales by LootDrop.
- Completed partial sales and distribution.

/bank
- Party balance.
- Member balances.
- Payments.
- Financial ledger.

/settings
- Party information.
- Distribution settings.
- Local data management.
- Backup and restore.

## 12. UI/UX

Visual direction:
- Modern SaaS dashboard.
- Dark interface.
- Subtle purple/red accents.
- Clean typography.
- Compact data tables.
- Clear financial statistics.
- Responsive layout.
- Desktop-first but mobile-friendly.

Avoid old MMORPG-style interfaces.

Prioritize fast data entry and clear financial information.

Provide:
- Loading states.
- Empty states.
- Error states.
- Confirmation dialogs.
- Toast notifications.
- Form validation.
- Search and filtering.

## 13. Backup and Data Safety

Implement local backup functionality.

Requirements:
- Export SQLite database.
- Include uploaded screenshots.
- Create a backup archive.
- Validate backups before restoring.
- Never overwrite existing data without confirmation.

## 14. Migration Readiness

Keep database access isolated in repositories/services.

Do not write database queries directly inside UI components.

Avoid SQLite-specific raw SQL unless necessary.

Keep business logic independent of the database provider.

Use Prisma migrations for durable schema changes. The disposable Phase 4.1
development database was synchronized with `db push` by explicit approval;
this is not a release migration and must be replaced with a reviewed,
versioned migration before distributing or deploying the financial schema.

Keep file storage behind an abstraction so local storage can later be replaced by cloud storage.

Future migration:
SQLite -> PostgreSQL.

## 15. Testing

Write tests for:
- Item duplicate detection.
- Item search.
- Reusing an existing item across raids.
- Acquisition history.
- Raid participant selection.
- Weighted Largest Remainder distribution.
- Idempotent sale and payout processing.
- Partial sales.
- Multiple sales per LootDrop.
- Payment calculations.
- Ledger posting and immutability.
- Historical data integrity.

## 16. MVP Acceptance Criteria

The application is usable when:

1. It starts locally without external services.
2. Data persists after application restart.
3. An administrator can manage party members.
4. An administrator can create raids and select actual participants.
5. Items can be added to a reusable catalog.
6. Existing items can be reused across raids.
7. Each item has a complete acquisition history.
8. Loot screenshots can be stored locally.
9. Sales can be recorded directly against LootDrop records.
10. Participant shares are calculated correctly and exactly conserve Adena.
11. Member balances and actual payments are tracked independently.
12. Posted financial history is preserved.
13. Database and screenshots can be backed up and restored.
14. Architecture supports future multi-party SaaS development.