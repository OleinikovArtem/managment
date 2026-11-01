# GitHub Copilot Instructions

You are assisting with the development of Party Bank Manager.

Before making changes, read:
- PROJECT_SPEC.md
- DEVELOPMENT_PLAN.md

## General Rules

1. Follow PROJECT_SPEC.md as the main source of requirements.
2. Follow DEVELOPMENT_PLAN.md for implementation order.
3. Work only on the currently active development phase.
4. Do not implement future SaaS functionality unless explicitly requested.
5. Do not generate the entire application at once.
6. Ask questions when important requirements are unclear.
7. Prefer simple and maintainable solutions.
8. Use TypeScript strict mode.
9. Avoid unnecessary dependencies.
10. Do not introduce paid services or external APIs.

## Architecture

- Use Next.js App Router.
- Separate UI from business logic.
- Keep database access in repositories.
- Keep business logic in services.
- Use Zod for input validation.
- Use reusable components.
- Keep financial calculations independent of UI.
- Scope business data by partyId.
- Do not hardcode party IDs.

## Database

- Use Prisma ORM.
- Use SQLite for local development.
- Create migrations for schema changes.
- Do not silently reset or delete the database.
- Preserve historical records.
- Use proper unique constraints.
- Avoid SQLite-specific application logic where possible.

## Financial Logic

- Never use floating-point arithmetic for Adena.
- Use integer arithmetic or BigInt.
- Never silently modify historical financial records.
- Use database transactions for sale registration and distribution.
- Keep earnings separate from payments.
- Always use the original raid participants for distribution.

## Item Catalog

- One unique Item record per party and canonical item name.
- Multiple LootDrop records can reference the same Item.
- Preserve original Lineage 2 item names.
- Prevent duplicate catalog records.
- Never merge separate acquisition records.
- Never create a new catalog item automatically from uncertain input.

## File Storage

- Store uploads outside the public static directory.
- Validate uploaded file types and sizes.
- Store relative paths in the database.
- Keep storage logic behind a service abstraction.

## Code Quality

- Use clear naming.
- Avoid giant components.
- Avoid duplicated business logic.
- Handle errors explicitly.
- Add tests for important business logic.
- Do not use `any` without a justified reason.
- Run lint and relevant tests after changes.
- Do not suppress TypeScript errors to make code compile.

## Working Process

Before implementing a task:
1. Explain the planned changes.
2. Identify affected files.
3. Identify potential risks.
4. Wait for approval for large or destructive changes.

After implementation:
1. Summarize completed work.
2. List changed files.
3. Report test results.
4. Mention unresolved issues.
5. Update DEVELOPMENT_PLAN.md.

Never claim that a feature is complete without verifying it.