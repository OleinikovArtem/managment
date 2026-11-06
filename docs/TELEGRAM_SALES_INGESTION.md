# Telegram sales ingestion

## Implementation and entry points

Party Bank receives Igri sale notices through a dedicated bot per party.
The owner connects the bot and chooses its source in `/settings/telegram`.
Every party member can read `/telegram`; administrators can maintain item aliases,
retry unresolved notices and dismiss them without creating sales.

The receiver is an authenticated HTTPS webhook at
`/api/telegram/webhook/[webhookId]`. Processing runs on the server, independently
of an open browser. No polling worker or outgoing chat messages are used.

## Owner setup

1. Create a dedicated receiving bot with `@BotFather` → `/newbot`.
2. Enable Bot-to-Bot Communication Mode. Add the receiving bot to the same group
   as Igri; grant the necessary administrator permissions or disable privacy mode.
3. Enter its token in `/settings/telegram`. The server calls `getMe`, encrypts
   the token and registers `setWebhook` with a random route and secret header.
4. After a bot posts a new message, refresh the discovered-source list. Choose
   the group and Igri, or enter their numeric IDs. Discovery stores at most 20
   chat/bot identities, not unrelated message bodies.
5. Save the source. Automatic importing begins with subsequent messages; source
   discovery does not backfill messages received before source selection.

Only OWNER can connect, replace, test or disconnect a bot or change the source.
One bot cannot belong to multiple Party Bank parties. Reconnecting rotates the
webhook route and secret; replacing the bot clears its old source configuration.
Disconnecting revokes the route and removes the credential, preserving imports
and financial history. If Telegram cannot remove its remote webhook, the old
route still cannot accept messages after local revocation.

Tokens use AES-256-GCM with `PARTY_TOKEN_ENCRYPTION_KEY`; they are never returned
to the browser or logged. The webhook secret is stored as a SHA-256 hash and
compared against `X-Telegram-Bot-Api-Secret-Token`. Lifecycle changes are serialized
with ingestion using a party advisory lock.

## English message format

Labels are provisional English translations of the agreed screenshot. Its numeric
example is four items at 42,222,222 Adena each, totaling 168,888,888. The name below
is illustrative; confirm labels and layout against a real Igri English notice.

```text
Successful sale
Item: Giant's Codex
Quantity: 4
Price per item: 42,222,222 Adena
Total: 168,888,888 Adena
Current Adena: 999,999,999
```

Recognized headings include `Successful sale`, `Sale successful`, `Sale completed`,
`Successfully sold`, `Item sold`, and `Your item has been purchased`.
A generic `Purchase successful` notice is not treated as sale income.

- `Item` / `Name`: item name.
- `Quantity` / `Qty` / `Amount`: positive whole quantity, at most 1,000,000 per row.
- `Price per item` / `Unit price` / `Price`: unit price. Multiply by quantity.
- `Subtotal` / `Row total`: proceeds for this row. If a unit price is also given,
  both values must agree.
- `Total` / `Sum`: optional notice-wide reconciliation, never an extra sale.
- `Current Adena` / `Adena balance` / `Balance`: ignored.

Multiple blocks and explicit compact rows are supported:

```text
Sale completed
Sword x2 @ 100 Adena each
Shield x3 = 75 Adena
Total: 275 Adena
```

Amounts are positive integer Adena, with optional comma or space thousands
separators. Decimal and ambiguous prices are rejected. A dash price requires
`each` / `per item`; `=` explicitly denotes a row total. Arithmetic uses BigInt,
bounded by PostgreSQL signed BIGINT. Unknown lines in a sale notice cause review,
so an unrecognized item row cannot be silently skipped. Limits: 16,000 characters,
50 item rows, and 100 loot allocations per notice.

The parser and translated example live in `src/server/telegram/sale-parser.ts`.
Changes to English labels belong there; existing manual money input is unchanged.

## Source filtering and financial processing

Only original `message` / `edited_message` updates in the configured group from
the configured bot ID are eligible. Human senders, other chats/bots, forwarded
messages and messages sent on behalf of a chat are ignored. The current balance
and unrelated notices create no financial entries.

Item matching uses normalized canonical names, display names and per-party
`TelegramItemAlias` records. An ambiguous match is never chosen automatically.
Only unsold loot in the same party is eligible. Allocate oldest raid first, then
loot creation time and ID. One row may span multiple raids; distribute its
proceeds per unit, assigning integer remainders to the earliest allocated units.
The exact row total is preserved. Repeated rows consume the shared remaining
quantity during planning; manual sales are deducted as well.

Every allocation uses the same transaction-level sale writer as manual sales:
equal PRESENT-participant shares from the original raid, historical weight
snapshots, balanced POSTED ledger entries and raid financial lock. All rows of
one notice, the final import state and system audit event commit together. A
failure in any row rolls back every financial write from that notice.

## Durable inbox, retries and edits

`TelegramSaleImport` uniquely identifies a source by party/chat/message ID.
Update IDs are retained as metadata; repeated updates cannot create another sale.
The received body and source hash remain available. An edit of an unresolved
notice replaces its unprocessed source body; posted notices retain their body.
Administrator corrections are stored separately in `correctedText`.

- `PENDING`: the inbox receipt is durable; processing or Telegram redelivery can
  continue. After a timeout, an administrator can also retry it from the history.
- `NEEDS_REVIEW`: malformed text, unresolved/ambiguous item, insufficient unsold
  loot, conflicting totals or a failed business invariant. No partial sale exists.
- `PROCESSED`: all allocations committed. Replays and manual retry cannot resell it.
- `IGNORED`: explicitly dismissed by an administrator without creating sales.

Known business failures are persisted and acknowledged. Temporary database
failures return 503 so Telegram can redeliver. Serializable transactions and
bounded retries handle concurrent imports; PostgreSQL guards protect against
concurrent manual sales too. No request relies on an in-memory background task.

Editing an already processed message only adds a warning; it does not rewrite
posted finance. An edit first seen without the original goes to review. Pending
or unresolved edits require explicit retry. Telegram message deletion is not a
refund or reversal; the Bot API receiver does not infer either from a deletion.

Party reset preserves the inbox and aliases as well as bot configuration. Old
processed notices remain deduplicated and cannot recreate cleared history.

## Notifications and operations

Authenticated pages check unread imports while visible, every 20 seconds and on
window focus. Fresh notifications show items, quantities, proceeds and raid
allocations; `/telegram` remains the persistent history after a toast disappears.
Read markers belong to individual users. History shows the 100 most recently
updated notices, so warnings about old edits return to the visible list;
alias maintenance exposes the first 2,000 catalog items and party aliases.

Webhook body size is limited to 64 KiB. Bad secrets are rejected before reading
the body. Logs and client errors exclude tokens, headers, payloads and Telegram
credential-bearing URLs. The published HTTPS origin is taken from
`TELEGRAM_WEBHOOK_BASE_URL`, falling back to `BETTER_AUTH_URL`. Local receiving
needs a public HTTPS tunnel; do not register a local test instance against a
production party's bot. See [DEPLOYMENT.md](./DEPLOYMENT.md).

Tests cover parsing, amount reconciliation, exact FIFO allocation, permissions,
header verification, encrypted connection lifecycle, duplicate/concurrent
delivery, full rollback, historical snapshots and edits. PostgreSQL integration
tests require a disposable `TEST_DATABASE_URL`. A live end-to-end Telegram check
additionally requires the owner's receiving bot and an actual Igri notice.

References: [Bot API webhooks](https://core.telegram.org/bots/api#setwebhook),
[Bot-to-Bot communication](https://core.telegram.org/bots/features#bot-to-bot-communication).
