# Docs index

Read only what your task needs. If a doc conflicts with the approved plan, the docs win, then the
plan's API contract. Rules marked **(proposal)** apply until a plan says otherwise.

| File | Covers | Read when |
|---|---|---|
| [architecture.md](architecture.md) | Stack and versions (living table), runtime topology, production target | Changing dependencies/infra, or you need versions or deploy context |
| [conventions/naming.md](conventions/naming.md) | Naming and casing for files, classes, DTOs, Prisma models, routes, env vars, events; units in names | Creating any new file, class, field, route or model |
| [conventions/coding-style.md](conventions/coding-style.md) | Prettier, ESM `.js` imports, exports, DI, async, types, comments | Writing any TypeScript |
| [conventions/modules-and-layers.md](conventions/modules-and-layers.md) | `src/` layout, module ownership table, controller/DTO/guard/service split, config | Adding a module, controller or service, or unsure where logic goes |
| [conventions/api-design.md](conventions/api-design.md) | REST routes, status codes, error body, DTO validation, pagination, response shapes, contract evolution | Adding or changing an endpoint or DTO |
| [conventions/error-handling.md](conventions/error-handling.md) | Typed exceptions, Prisma error translation, logging rules | Throwing/catching errors or adding logs |
| [erd.dbml](erd.dbml) | MVP data model as DBML (tables, enums, indexes, relations, DB-level invariants); render it at dbdiagram.io | Designing or reviewing the schema, or you need the big picture of the data model |
| [conventions/database.md](conventions/database.md) | Prisma model template, IDs, timestamps, money, queries, transactions, migrations, `PrismaService` | Touching `schema.prisma`, migrations or Prisma queries |
| [conventions/testing.md](conventions/testing.md) | What needs unit/e2e/concurrency tests and how to write them (Vitest) | Writing or reviewing tests |
| [conventions/git-workflow.md](conventions/git-workflow.md) | Plan first, slices, commit messages, never push | Before committing or planning slices |
| [conventions/common-mistakes.md](conventions/common-mistakes.md) | Checklist of frequent mistakes, linked to the full rules | Self-review before handing off; QA review |
| [rules/business-invariants.md](rules/business-invariants.md) | Agreed domain rules (format, open questions, rejected alternatives) | Implementing or reviewing domain logic |
| [rules/security.md](rules/security.md) | Security invariants (passwords, tokens, auth, ownership, validation) and how to apply them | Touching auth, endpoints, user input, secrets or uploads |
| [known-deviations.md](known-deviations.md) | Where the current code does not follow these docs yet | Editing a file listed there, or before flagging it in review |
