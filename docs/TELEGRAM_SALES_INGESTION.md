# Telegram sales ingestion

## Status

Agreed product behavior and integration constraints are documented here. The
Telegram listener, parser, automatic matching, and notifications are not
implemented yet. This document describes the intended behavior, not a delivery
schedule.

## Source and scope

- A dedicated Party Bank Manager bot will receive successful sale notices
  posted by the Igri bot in the group's Telegram chat.
- Process only messages from the configured chat and Igri bot. Ignore unrelated
  messages and the player's current Adena balance.
- The expected notice language is English. Item names may be adjusted over time,
  so matching must support alternate names for a catalog item.
- A successful sale is automatic. Do not ask for confirmation for ordinary,
  unambiguous notices.

## Sale data contract

Extract each item row independently:

- Item name (resolve through a normalized name or configured alias).
- Quantity sold.
- Adena proceeds for that row.

The screenshot example has one row with quantity 4 at 42,222,222 Adena each,
and a total of 168,888,888 Adena. When a row states a per-item price, calculate
its row proceeds as quantity multiplied by unit price. If the English notice
provides a row total instead, use that total directly. The notice's overall
`Sum`/`Total`, when present, is a reconciliation value and must not be recorded
as an additional sale. A `Current Adena` balance is never sale proceeds.

If one notice contains multiple item rows, record each row using that row's
quantity and proceeds. Do not divide a notice-wide total between rows unless
the source format provides enough information to do so. Exact English labels
and formatting must be verified against a raw example before implementing the
parser.

## Raid matching and allocation

- Resolve item names to the existing catalog item using case/spacing
  normalization and maintained aliases. Do not silently choose between
  ambiguous item matches.
- Match only against remaining unsold quantity in raid loot.
- Allocate from the oldest raid with available quantity first. If a line's
  quantity spans multiple raids, continue to the next-oldest eligible raid.
- Split the row's proceeds across those allocations according to units sold;
  preserve the exact Adena total when splitting integer amounts.
- Record each allocation through the existing sale business logic so the
  current financial invariants and raid distribution rules remain in force.
- Reprocessing a Telegram update must never create a duplicate sale. Use the
  source chat/message identity as an idempotency key.

An item that cannot be matched unambiguously must not be silently attached to a
different item or raid. The implementation needs an exception state and a
visible notification for unmatched or malformed notices; the exact resolution
workflow remains to be agreed. This exception handling does not add
confirmation to normal matched sales.

## Notifications

Show a fresh in-app notification with the item, quantity, Adena proceeds, and
raid allocation. For a notice with several rows, keep the rows together in one
notification while showing the raid used for each allocation. The notification
must remain discoverable after its transient toast disappears.

## Telegram and runtime requirements

- Each party owner connects a dedicated receiving bot for that party. The owner
  enters the BotFather token in the party's Telegram settings; do not configure
  one party's bot through a shared application environment variable.
- Enable Bot-to-Bot Communication Mode for the receiving bot in `@BotFather`.
  For unmentioned group notices, add it as an administrator with only necessary
  rights, or disable its group privacy mode. The receiving bot and Igri must be
  in the same group.
- Include an in-app setup guide for the owner:
  1. Open `@BotFather`, create a bot with `/newbot`, and copy its API token.
  2. Enable Bot-to-Bot Communication Mode for the new bot in BotFather.
  3. Add the bot to the group that contains Igri, granting the minimum access
     required for it to receive group messages.
  4. Paste the token into the party's Telegram settings. Token storage is
     implemented; connection testing and group selection from received updates
     are not available because the listener is not implemented.
- Only the party owner can view, replace, test, or disconnect the bot token.
  Store it encrypted at rest, expose it only to the server-side listener, mask
  it after saving, and never include it in logs or error messages. Keep the
  encryption key in server-side deployment secrets.
- Telegram Bot API supports either long polling (`getUpdates`) or a webhook for
  a bot at a time, not both. The deployment target uses a webhook to a protected
  Next.js Route Handler; do not run a long-lived polling worker in a Vercel
  Function. Filter by configured chat and sender IDs and verify Telegram's
  configured webhook secret token.
- The webhook handler must fit the host's request execution limits and safely
  handle retries. Persist the update identity and sale allocations atomically;
  return success only after the update is durably recorded. For work that cannot
  complete within one request, persist a job and process it with an explicitly
  selected durable worker/queue rather than relying on an in-memory background
  task.
- Local development may use a tunnel or manual test updates. Production receipt
  requires the deployed HTTPS endpoint to remain reachable; it does not depend
  on a user's browser being open.
- Handle retries, reconnects, and duplicate deliveries using the idempotency
  rule above.

Telegram references: [Bot-to-Bot communication](https://core.telegram.org/bots/features#bot-to-bot-communication),
[receiving updates](https://core.telegram.org/bots/api#updating-messages).

## Unresolved integration behavior

- Obtain a raw English notice containing multiple item rows to lock down labels,
  quantity syntax, whether row values are unit prices or row totals, and the
  overall reconciliation field.
- Agree how an unmatched or ambiguous notice is resolved and retried.
- Agree how edits or deletion of an already processed Telegram message affect
  an existing financial record.
- The webhook route, durable retry behavior, and production domain are not yet
  implemented; deployment constraints are described in [DEPLOYMENT.md](./DEPLOYMENT.md).
