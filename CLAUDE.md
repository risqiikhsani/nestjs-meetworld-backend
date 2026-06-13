# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **NestJS 11** on **Express 5**, **TypeScript 5.7** (module: `nodenext`), **pnpm**
- **TypeORM 0.3** + **PostgreSQL** (driver: `pg`)
- **class-validator** + **class-transformer** for DTO validation
- **Jest 30** for unit tests (no e2e harness — see below)
- **ESLint 9** flat config with `typescript-eslint` type-checked rules + **Prettier**; `endOfLine: "auto"` (matters on Windows)

## Common commands

```bash
pnpm install                 # install
pnpm run build               # nest build → dist/
pnpm run start:dev           # watch mode
pnpm run start               # one-shot dev start
pnpm run start:prod          # node dist/main
pnpm test                    # all *.spec.ts under src/
pnpm test -- users           # one spec file
pnpm test -- -t "findOne"    # one test by name
pnpm run test:watch          # jest --watch
pnpm run test:cov            # with coverage
pnpm run lint                # eslint --fix over src/ and test/
pnpm run format              # prettier --write
```

> There is no working e2e setup. `pnpm run test:e2e` points at `test/jest-e2e.json`, but that file was removed; the script is dormant. Add it back if you reintroduce e2e tests.

## Architecture

### Module layout

Two feature modules plus a `common` layer and a `config` layer.

```
src/
  main.ts                            # bootstrap: prefix, ValidationPipe, filter
  app.module.ts                      # composes ConfigModule + TypeOrm + feature modules
  config/typeorm.config.ts           # TypeOrmModuleAsyncOptions factory (injects ConfigService)
  common/
    exceptions/resource-not-found.exception.ts
    filters/http-exception.filter.ts # @Catch() global — shapes all errors as JSON
  users/                             # user API
  posts/                             # user's posts API
  profiles/                          # user's profile API
  uploads/                           # upload files API
```

### Dependency direction (the key thing to understand at a glance)

`PostsModule` imports `UsersModule`. This is the only cross-module edge in the app, and it's how the project applies the **Dependency Inversion** principle: `PostsService` injects `UsersService` (an abstraction) rather than reaching into `Repository<User>`. The result is that every post operation first calls `usersService.findOne(userId)`, which throws `ResourceNotFoundException` (404) if the parent user is missing — and the post lookup is then scoped by `authorId: userId` so posts can't leak across users. `UsersModule` must keep `exports: [UsersService]` for this to work; don't remove it.

### Cross-cutting wiring (set up in `main.ts`)

- Global URL prefix: `/api`
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — this is what strips a spoofed `authorId` from `POST /api/users/:userId/posts`. Don't weaken it.
- Global `HttpExceptionFilter` produces a uniform error shape: `{ statusCode, timestamp, path, message }` and logs 5xx via Nest's `Logger`.
- `ConfigModule` is global, loads `.env`. All config goes through `ConfigService`; nothing reads `process.env` directly except the port fallback in `main.ts`.

### Data layer

- TypeORM connection is built by `typeOrmAsyncConfig` in `src/config/typeorm.config.ts`. It pulls `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` from `ConfigService` (use `getOrThrow`).
- **`synchronize: true` is dev-only.** It auto-creates/alters tables on boot. Flip it off and add migrations before any production deploy.
- Entities use `PrimaryGeneratedColumn('uuid')` — TypeORM generates UUIDs in application code, no Postgres `uuid-ossp` extension required.
- `posts.author_id` has `onDelete: CASCADE` and an index named `idx_posts_author_id`. `users.email` has a unique index.

### Test conventions

- Specs live next to source as `*.spec.ts`. Jest's `rootDir` is `src/`, `testRegex` is `.*\\.spec\\.ts$`.
- Service specs mock `Repository<T>` via `getRepositoryToken(Entity)` and any cross-module services as plain `useValue` providers. Pattern is consistent across `users.service.spec.ts` and `posts.service.spec.ts` — copy that shape for new services.

### Things that aren't here yet

- **No auth.** No JWT, no guards, no `current-user` decorator. Endpoints are public.
- **No migrations.** Schema is created by `synchronize`.
- **No Swagger / OpenAPI.**
- **No e2e tests.**
