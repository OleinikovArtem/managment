<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project context

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
