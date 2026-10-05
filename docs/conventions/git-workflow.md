# Git workflow

## 1. Plan first

Anything non-trivial starts in plan mode: agree on the scope, the slices and the affected docs before writing code.

## 2. Slices

A slice is the smallest change that leaves the repo working, tested and documented. Typical slices in this project:

| Slice | Contains |
|---|---|
| Schema | Prisma model change + migration (+ ERD update if `docs/reference/` has one) |
| Service | Service methods + their unit tests |
| Endpoint | Controller + DTOs + e2e test |
| Infra | Dependency, config or tooling change + `CLAUDE.md` "Stack — current state" update |

**A slice is not done until the docs it affects are updated in the same commit** (`CLAUDE.md` stack/commands, module table in `coding-style.md`, invariants in `business-invariants.md`, etc.).

Before committing: `npm run lint`, `npm test`, and `npm run test:e2e` if the slice touches endpoints.

## 3. Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), with the module as scope:

```
<type>(<scope>): <summary in imperative, lowercase>

<optional body: why, not what>
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`.
- Scope: the module (`auth`, `prisma`, ...), or `repo` for project-wide changes.
- Examples: `feat(auth): add login endpoint`, `chore(prisma): add initial migration`.

Rules:
- The full commit message is shown in chat and approved **before** committing.
- No AI attribution: no `Co-Authored-By`, no "Generated with".

## 4. Push

**Never `git push`** unless explicitly asked at that moment. Approval to commit is not approval to push.
