# Coding style

TypeScript-level rules: formatting, imports, exports, DI, async, types, comments. For where code
goes (modules, layers) see [modules-and-layers.md](modules-and-layers.md); for names see
[naming.md](naming.md).

## Formatting

- **Prettier wins** (`singleQuote`, `trailingComma: "all"`, 2 spaces, semicolons). Never hand-format
  against Prettier. `npm run format:check` and `npm run lint` must be green.
- oxlint runs type-aware (`npm run lint`).

## ESM imports

The project is ESM (`"type": "module"`, `moduleResolution: nodenext`).

- **Relative imports must include the `.js` extension**, even from `.ts` files:

  ```ts
  import { AppService } from './app.service.js';
  ```

- Import the Prisma client from `generated/prisma` (e.g. `'../../generated/prisma/client.js'`),
  **never** from `@prisma/client`.
- Import order: Node built-ins (`node:crypto`) → packages → `generated/` → relative. Groups
  separated by a blank line.
- **No `import type`** for injected classes or DTOs used in decorated signatures: with
  `emitDecoratorMetadata` + `isolatedModules` the metadata is lost and DI/validation fails
  silently. Use `import type` only for pure interfaces/types.

## Exports and files

- **Named exports** only, no `export default`. One main class per file.
- No `index.ts` barrels (they cause import cycles under ESM).

## Dependency injection

Always inject through the constructor:
`constructor(private readonly itemsService: ItemsService) {}`.
❌ `new ItemsService()` / `new PrismaClient()` inside a class.

## Async

`async/await`, never chained `.then()`. Every promise is `await`ed or `return`ed
(`no-floating-promises` is an error).

## Types

- Avoid `any` (the linter allows it, QA does not): use `unknown` + narrowing.
- Explicit return types on public service methods.

## Control flow and constants

- Early return instead of nested `if/else`.
- No magic numbers: use a named constant.

## Comments

In English and only for the **why**. No commented-out code, no `console.log`.
