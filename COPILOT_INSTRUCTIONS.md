# Repository instructions for GitHub Copilot

Read [AGENTS.md](./AGENTS.md) and [docs/PROJECT_CONTEXT.md](./docs/PROJECT_CONTEXT.md).
They define the repository rules and source map.

- Current product behavior: [PROJECT_SPEC.md](./PROJECT_SPEC.md).
- Data and financial invariants: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- Interface conventions: [docs/UI_RULES.md](./docs/UI_RULES.md).
- Setup, checks and recovery: [README.md](./README.md).

Follow the user's current task. Preserve data and historical financial records.
Do not reset the database, change money semantics or implement unrelated features.
Keep documentation about the running system and its rules, not development phases.
