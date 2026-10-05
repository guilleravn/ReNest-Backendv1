# Git workflow

## 1. Plan first

Anything non-trivial starts in plan mode: agree on the scope, the slices and the affected docs
before writing code.

## 2. Slices

Commit per slice, never everything at the end. A slice is the smallest change that leaves the repo
working, tested and documented. Typical slices in this project:

| Slice | Contains |
|---|---|
| Schema | Prisma model change + migration (+ ERD update if `docs/reference/` has one) |
| Service | Service methods + their unit tests |
| Endpoint | Controller + DTOs + e2e test |
| Infra | Dependency, config or tooling change + "Stack — current state" update in `docs/architecture.md` |

**A slice is not done until the docs it affects are updated in the same commit** (stack table in
`docs/architecture.md`, commands in `CLAUDE.md`, module table in `modules-and-layers.md`,
invariants in `business-invariants.md`, etc.), together with its tests.

Before committing: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` (the
pre-commit hook runs these), and `npm run test:e2e` if the slice touches endpoints.

## 3. Grouping commits

Commits are made by the QA agent right after it approves a work package, without asking for
approval. Group the changes by **functionality or area**: each commit is one coherent change that
a one-line message describes (a feature in a module, a refactor, the tests of a module).

Balance the number of commits against their size:

- Not too many: no commit per file or per tiny step (a lone DTO, an import fix).
- Not too big: an issue that spans several modules or features is split by module/feature.
- Usually 1–4 commits per work package.
- Every commit leaves the repo green (the hook checks it) and carries the docs it affects.
- Tests go with the code they verify; QA's extra tests for a module may go in their own commit.

```
feat(listings): add status filter to listings query
refactor(auth): move token parsing into the auth service
test(listings): add e2e tests for the status filter
```

## 4. Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) in English, with the module as scope:

```
<type>(<scope>): <summary in imperative, lowercase>

<optional body: why, not what>
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`.
- Scope: the module (`items`, `auth`, `prisma`, ...), or `repo` for project-wide changes.
- Summary: imperative, lowercase, no trailing period, ≤ 72 characters.
- Body optional, explaining the **why**. Reference the issue in the body when applicable
  (`Refs: BO-27`).
- ✅ `feat(items): add item listing endpoint`, `chore(prisma): add initial migration` ·
  ❌ `Added items`, `feat: Add items.`

Rules:
- No AI attribution: no `Co-Authored-By`, no "Generated with".
- Never commit `.env`, `generated/`, `dist/`, `coverage/`, or real data/PII in fixtures.

## 5. Push

**Never `git push`** unless explicitly asked at that moment. A generic "you can always push" does
not count, and permission to commit is not permission to push.
