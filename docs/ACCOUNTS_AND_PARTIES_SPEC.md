# Accounts and parties

## Status

Product requirements for the proposed multi-user accounts feature. Authentication,
party membership, invitation links, and role enforcement are not implemented yet.

## Accounts and parties

- Users can register, sign in, sign out, and recover access to their account.
- A user can create a party and becomes its owner and an administrator.
- A user may belong to more than one party and can switch the active party.
- Operational records belong to a party. A user can access them only while they
  are a member of that party.
- On first enablement, existing local data is migrated into the current owner's
  party without losing records, history, or financial integrity.

## Roles

- **Owner:** the user who created the party. Has administrator permissions and
  exclusively manages the party's Telegram bot connection and credentials.
- **Administrator:** manages party operations, including raids, compositions,
  participants, and financial records; can create and revoke invitations.
- **Member:** can view party activity and financial information but cannot make
  changes.
- A party must retain at least one owner/administrator. Ownership transfer and
  party deletion rules must prevent orphaning party data.

The shared base item catalog cannot be deleted by party users. Base catalog
records are not editable on a per-party basis; party-specific aliases or display
overrides, if needed, must remain scoped to that party.

## Invitations

- An administrator creates an invitation link for one party.
- The link contains a cryptographically random opaque token, not a party ID.
- The invitee may register or sign into an existing account, review the party,
  and accept the invitation to join as a member.
- Administrators can revoke an invitation. Expiry and use limits are configurable
  product decisions; the initial proposal is a seven-day, single-use link.

## Telegram bot settings

- The party owner can connect one dedicated Telegram receiving bot to the party
  by entering its BotFather API token in the party settings.
- Provide an in-app setup guide: create a bot via `@BotFather` `/newbot`, enable
  Bot-to-Bot Communication Mode, add it to the group containing Igri with the
  minimum required access, enter the token, then verify the connection and select
  the detected group.
- Allow the owner to test, replace, or disconnect the token. Other party
  administrators and members cannot view or change it.
- Store bot credentials encrypted at rest and server-side only. Mask the token
  after saving; never return it to the browser after submission or write it to
  logs. The encryption key is a deployment secret.
- Message ingestion and sale parsing follow
  [Telegram sales ingestion](./TELEGRAM_SALES_INGESTION.md).

## Security and authorization

- Enforce party membership and role permissions on the server for every read and
  write, including Server Actions, routes, exports, and background jobs. Default
  to deny when membership or role cannot be verified.
- Scope data access by the active party obtained from the authenticated session;
  never trust a client-supplied party ID as authorization.
- Store passwords using a modern password hashing algorithm. Use server-managed
  sessions in `HttpOnly`, `Secure`, `SameSite` cookies; do not store session
  credentials in browser storage.
- Rate-limit registration, login, password recovery, and invitation acceptance.

## Deployment and migration

Multi-user access requires the application to be reachable by party members and
to use one shared server-side database. The project is configured for Vercel Hobby
and Neon PostgreSQL; local development uses PostgreSQL in Docker Compose. See
[deployment rules](./DEPLOYMENT.md). The app still has no account authentication
or authorization, so it must not be exposed publicly until server-side party
access checks are implemented.

## Acceptance criteria

- A user cannot read or alter another party's data by changing a URL, request
  payload, export parameter, or record ID.
- Members can view but cannot edit party data; administrators can perform party
  operations; only the owner can manage the Telegram token.
- Invalid, expired, revoked, or already-used invitations cannot grant access.
- The base item catalog cannot be deleted by party users.
- Migration preserves the existing party's financial and historical records.
- Bot credentials are never visible to non-owners or returned in plaintext after
  initial submission.

## Decisions to confirm before implementation

- Registration method and email delivery provider.
- Invitation expiry and whether links are single-use or reusable.
- Whether members may eventually create specific records, such as sale notes,
  without gaining broader edit rights.
- Verify current Vercel/Neon free-tier terms, quotas, and account availability
  before production deployment.
- Ownership transfer, account deletion, and party closure behavior.
