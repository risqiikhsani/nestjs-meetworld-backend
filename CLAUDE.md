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

Three feature modules plus a `common` layer and a `config` layer.

```
src/
  main.ts                            # bootstrap: prefix, ValidationPipe, filter, guard, serializer
  app.module.ts                      # composes ConfigModule + TypeOrm + feature modules
  config/typeorm.config.ts           # TypeOrmModuleAsyncOptions factory (injects ConfigService)
  common/
    exceptions/resource-not-found.exception.ts
    filters/http-exception.filter.ts # @Catch() global — shapes all errors as JSON
  users/                             # user API
  posts/                             # user's posts API
  profiles/                          # user's profile API
  uploads/                           # upload files API
  auth/                              # JWT auth (local strategy only; OAuth slot reserved)
  health/                            # liveness/readiness check
```

### Dependency direction (the key thing to understand at a glance)

`PostsModule` and `ProfilesModule` both import `UsersModule`. `AuthModule` also imports `UsersModule`. This is the project's **Dependency Inversion** principle at work: downstream services inject `UsersService` (an abstraction) rather than reaching into `Repository<User>`. The result is that every post/profile/auth operation first calls `usersService.findOne(userId)` (or `findByEmail`), which throws `ResourceNotFoundException` (404) if the parent user is missing — and the post lookup is then scoped by `authorId: userId` so posts can't leak across users. `UsersModule` must keep `exports: [UsersService]` for this to work; don't remove it.

### Cross-cutting wiring (set up in `main.ts`)

- Global URL prefix: `/api`
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — this is what strips a spoofed `authorId` from `POST /api/users/:userId/posts`, and a spoofed `passwordHash` from `POST /api/auth/register`. Don't weaken it.
- Global `HttpExceptionFilter` produces a uniform error shape: `{ statusCode, timestamp, path, message }` and logs 5xx via Nest's `Logger`.
- Global `ClassSerializerInterceptor` honors `@Exclude()` on entities. The `User` entity uses `@Exclude({ toPlainOnly: true })` on `passwordHash` so the bcrypt hash never reaches a response — don't remove the interceptor.
- Global `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`) makes every route private by default. Opt out with `@Public()` (used by `HealthController` and `AuthController`). Adding a new feature controller without `@UseGuards(...)` is fine — it's already protected.
- `ConfigModule` is global, loads `.env`. All config goes through `ConfigService`; nothing reads `process.env` directly except the port fallback in `main.ts`.

### Data layer

- TypeORM connection is built by `typeOrmAsyncConfig` in `src/config/typeorm.config.ts`. It pulls `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` from `ConfigService` (use `getOrThrow`).
- **`synchronize: true` is dev-only.** It auto-creates/alters tables on boot. Flip it off and add migrations before any production deploy.
- Entities use `PrimaryGeneratedColumn('uuid')` — TypeORM generates UUIDs in application code, no Postgres `uuid-ossp` extension required.
- `posts.author_id` has `onDelete: CASCADE` and an index named `idx_posts_author_id`. `users.email` has a unique index.

### Auth layer

- `src/auth/` is its own module. `AuthController` exposes `POST /api/auth/register` and `POST /api/auth/login` (both `@Public()`); both return `{ access_token, user: { id, email, name } }`.
- Login identifier is **email** (the existing `users.email` unique column). There is no `username` column.
- Passwords are bcrypt-hashed at cost 12. The plaintext password never touches `UsersService` — hashing lives in `AuthService.register` and comparison in `AuthService.validateUser`.
- Token is a standard HS256 JWT signed with `JWT_SECRET` (read via `ConfigService.getOrThrow`), expiring after `JWT_EXPIRES_IN` (default `1d`). Payload: `{ sub: userId, email }`.
- `JwtStrategy.validate` does **not** re-fetch the user from the DB on every request — it just returns `{ id: payload.sub, email: payload.email }` as `req.user`. Read it via `@CurrentUser()` or `@Req()`.
- `User.passwordHash` is typed `string | null` and column `nullable: true`. Legacy users (created before auth was added) have `null` and cannot log in — they must be re-registered or backfilled by a migration. To harden later, write a one-shot migration to backfill + `SET NOT NULL`, then flip the entity.

### Test conventions

- Specs live next to source as `*.spec.ts`. Jest's `rootDir` is `src/`, `testRegex` is `.*\\.spec\\.ts$`.
- Service specs mock `Repository<T>` via `getRepositoryToken(Entity)` and any cross-module services as plain `useValue` providers. Pattern is consistent across `users.service.spec.ts` and `posts.service.spec.ts` — copy that shape for new services.

### Things that aren't here yet

- **No migrations.** Schema is created by `synchronize`.
- **No Google / OAuth provider.** `AuthService.validateUser` is the seam; a second strategy file + a new service method is all that should be needed.
- **No Swagger / OpenAPI.**
- **No e2e tests.**
