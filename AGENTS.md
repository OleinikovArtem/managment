<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project context

Localhost Docker PostgreSQL contains disposable application data; only the item
catalog must be preserved. E2E may create raids, groups, members, sales and payments
in the existing local database using the existing local account. Financial records
there are test data. No additional database or server environment is required.
Never delete or reset the item catalog as part of test preparation or cleanup.

Start with `docs/PROJECT_CONTEXT.md` for a compact map of the implementation and
task-specific source files. Read `docs/ARCHITECTURE.md` when changing data flows,
financial logic, persistence or backups. `PROJECT_SPEC.md` describes current product
behavior and rules; `docs/UI_RULES.md` defines interface conventions.

Keep these notes current when changing architecture, invariants or workflows.
Read only the sections and source files relevant to the task; verify facts in code.
Never reset the local database to investigate a problem. The financial schema is
not fully represented in checked-in migrations; see the architecture notes before
running schema commands. Do not edit generated Prisma output.

Keep documentation about the current system and its rules. Do not add phase logs,
approval histories, completion checklists or generated review reports. Update the
relevant canonical document when behavior changes; remove obsolete references.

Preserve existing financial semantics. Money uses integer BigInt and decimal
strings at serialization boundaries. Sale distribution is equal among PRESENT
participants of the original raid. Historical weight snapshots must match source
metadata, even when calculation weights are 1. Numeric input, default multipliers
and payment-prefill behavior require explicit approval before changing.

Use TypeScript strict mode, existing architecture and dependencies. Keep business
logic out of presentation components. Run checks appropriate to the change;
UI changes require desktop/mobile visual review, not compilation alone. Report
actual verification and material limits without claiming checks that were not run.

## E2E coverage

Every new user-facing feature or change to an existing user workflow must include
new or updated Playwright E2E tests in `e2e/` in the same change. Cover the primary
flow and relevant validation failures, permissions, group isolation and persisted
results. Financial flows must verify exact amounts and applicable invariants.
Add a regression scenario for reproduced user-visible bugs. Assertions must verify
the user's result; a page heading or successful HTTP response alone is insufficient.

Reuse existing fixtures and the existing local account and Docker database.
Preserve the item catalog and keep credentials and generated artifacts out of Git.
Chromium is the required browser; include mobile widths and keyboard scenarios
when the feature affects those flows.

Run affected E2E scenarios during development and the full Chromium suite before
committing a feature. Treat coverage and verification as part of feature completion.
If an environment problem prevents execution, report the concrete blocker and
which scenarios remain unverified; never claim a skipped or unrun check passed.
