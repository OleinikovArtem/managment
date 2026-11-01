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
- createdAt
- updatedAt

### RaidParticipant

Fields:
- id
- partyId
- raidId
- memberId

Unique constraint:
raidId + memberId.

Store actual participants independently for every raid.

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
- LISTED
- PARTIALLY_SOLD
- SOLD
- CANCELLED

Multiple LootDrop records can reference the same Item.

Never create a new Item just because an existing item drops again.

### SaleListing

Fields:
- id
- partyId
- lootDropId
- quantityListed
- quantitySold
- askingPrice (optional)
- status
- listedAt
- updatedAt

Statuses:
- LISTED
- PARTIALLY_SOLD
- SOLD
- CANCELLED

### SaleTransaction

Fields:
- id
- partyId
- saleListingId
- quantitySold
- totalPrice
- currency
- source
- soldAt
- createdAt

Support partial sales and multiple transactions per listing.

### SaleShare

Fields:
- id
- partyId
- transactionId
- memberId
- amount

Stores actual participant shares for every transaction.

### LedgerEntry

Fields:
- id
- partyId
- memberId (optional)
- type
- amount
- description
- relatedTransactionId (optional)
- createdAt

Types:
- SALE_CREDIT
- PAYMENT
- ADJUSTMENT
- REFUND

Use integer Adena amounts.

Use Prisma BigInt where appropriate. Never use floating-point arithmetic for financial calculations.

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

Implement:
- Create sale listing from LootDrop.
- Set asking price.
- Change listing status.
- Record manual sale.
- Support partial sales.
- View sale history.
- Link each transaction to its original raid and item.

A sale must use participants of its originating raid.

Never use the current party roster for historical distribution.

## 10. Financial Management

Default rule: equal distribution between actual raid participants.

Formula:

share = transaction.totalPrice / participantCount

Use integer arithmetic.

Remainders must be handled deterministically and retained in the party bank.

Keep separate:
- Party bank.
- Member accrued earnings.
- Member actual payments.
- Outstanding member balances.

Every sale creates:
- SaleTransaction.
- SaleShare records.
- SALE_CREDIT ledger entries.

Every payment creates a PAYMENT ledger entry.

Never silently modify financial history.

Corrections must create compensating entries.

Perform sale registration and distribution in one database transaction.

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
- Listings.
- Completed sales.
- Partial sales.

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

Use Prisma migrations.

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
- Equal distribution.
- Remainder handling.
- Partial sales.
- Multiple sales per listing.
- Payment calculations.
- Manual adjustments.
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
9. Items can be listed for sale.
10. Sales can be registered manually.
11. Participant shares are calculated correctly.
12. Member balances and payments are tracked.
13. Financial history is preserved.
14. Database and screenshots can be backed up and restored.
15. Architecture supports future multi-party SaaS development.