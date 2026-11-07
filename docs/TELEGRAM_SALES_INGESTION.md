# Telegram sales ingestion

## Implementation and entry points

Party Bank receives BohPTSbot sale notices through a dedicated bot per party.
The owner connects the bot and chooses its source in `/settings/telegram`.
Every party member can read `/telegram`; administrators can maintain item aliases,
retry unresolved notices and dismiss them without creating sales.

The receiver is an authenticated HTTPS webhook at
`/api/telegram/webhook/[webhookId]`. Processing runs on the server, independently
of an open browser. No polling worker or outgoing chat messages are used.

## Owner setup

1. Create a dedicated receiving bot with `@BotFather` → `/newbot`.
2. Enter its token in `/settings/telegram`. The server calls `getMe`, encrypts
   the token and registers `setWebhook` with a random route and secret header.
3. Open the receiving bot in Telegram and press Start. Forward an original sale
   notice from `@BoHpts_bot`, preserving the visible forward attribution.
   No group membership, Bot-to-Bot mode or Group Privacy changes are needed for
   this private-chat workflow. Pasted text and hidden-origin forwards are rejected.
4. Refresh the discovered-source list. Select the owner's private chat and BOHPTS
   as the original bot, not the human forwarding it. Discovery stores at most 20
   chat/bot identities, not unrelated message bodies. Known numeric IDs may also
   be entered manually; private chat IDs are positive, group IDs negative.
5. Save the source, then forward the sale again. Automatic importing begins with
   subsequent messages; discovery does not backfill earlier messages. Only the
   selected chat is accepted; another user's private chat cannot post sales.

Existing direct bot messages in selected groups remain supported, as do attributed
human forwards in a selected group. Group reception requires administrator access
or disabled Group Privacy; direct bot messages additionally require Telegram's
Bot-to-Bot mode. Adding BOHPTS to a group does not redirect private notifications.
Separate channels and topic-specific filtering are not implemented.

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

The observed BOHPTS English notice uses the following layout. Item and currency
icons can precede the item name and `Adena`; buyer, section heading, balance and
the server/character footer are metadata, not sale income.

```text
💰 Successful sale
Buyer: Love

Items:
- Sealed Moirai Leather Boots × 1 @ 22 222 222 Adena

Total: 22 222 222 Adena
💰 Current adena: 854 896 093

🌟 Phenomenon x20 · 👤 Miva
```

The original translated label format also remains supported:

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

Only `message` / `edited_message` updates in the configured chat are eligible.
Private-chat intake requires a human-forwarded message whose Telegram-provided
`forward_origin` is `user` with `sender_user.is_bot = true` and the configured
original bot ID. It uses the original notice timestamp for the sale, not the
forwarding timestamp. Originals from the configured bot are also accepted in a
configured group. Pasted human text, hidden origins, other chats/bots and messages
sent on behalf of a chat are ignored. The current balance and unrelated notices
create no financial entries.

Item matching uses normalized canonical names, display names and per-party
`TelegramItemAlias` records. Only global items and items owned by the importing
party are eligible, including archived items needed for historical unsold loot.
An explicit party alias chooses its exact eligible item; without an alias, an
ambiguous canonical/display match is never chosen automatically. Other parties'
private catalog entries are excluded from lookup and alias maintenance.
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
Forwarded message IDs use `forward:<forwarder ID>:<destination message ID>`.
Under the party lock, the original bot ID, original timestamp and exact body hash
are compared with posted imports whenever either copy is forwarded. Re-forwarding
to a new destination after changing the configured chat does not post another sale;
the new receipt is IGNORED with a reference to the posted import. Telegram does not
expose the original message ID for private-chat forwards. Two genuinely distinct
notices with the same sender, second and exact body therefore cannot be distinguished
and are conservatively treated as duplicates; resolve such a case manually.
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
When the selection includes sales, processed receipts retain PROCESSED for replay
protection, but allocations are cleared and a reset explanation is recorded.
PENDING and NEEDS_REVIEW receipts become IGNORED so they cannot resume processing
against the reset state. A payout-only or composition-only reset leaves imports intact.

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
additionally requires the owner's receiving bot and an actual BohPTSbot notice.

References: [Bot API webhooks](https://core.telegram.org/bots/api#setwebhook),
[Bot-to-Bot communication](https://core.telegram.org/bots/features#bot-to-bot-communication).
