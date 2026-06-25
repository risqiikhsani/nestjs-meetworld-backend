# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **NestJS 11** on **Express 5**, **TypeScript 5.7** (module: `nodenext`), **pnpm**
- **TypeORM 0.3** + **PostgreSQL** (driver: `pg`)
- **ioredis 5** for cache + global `@Global()` module
- **@nestjs/swagger** for OpenAPI 3 (served at `/api/docs`; also dumped to `openapi.json` on boot)
- **class-validator** + **class-transformer** for DTO validation
- **bcrypt** (cost 12) for passwords, **@nestjs/jwt** + **passport-jwt** for auth
- **@aws-sdk/client-s3** + **multer** for S3 multipart uploads
- **Jest 30** for unit tests (no e2e harness — see below)
- **ESLint 9** flat config with `typescript-eslint` type-checked rules + **Prettier**; `endOfLine: "auto"` (matters on Windows)

## Common commands

```bash
pnpm install                 # install
pnpm run build               # nest build → dist/  (REQUIRED before TypeORM CLI commands)
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

# TypeORM CLI — always run from the compiled output in dist/
pnpm typeorm migration:generate -d src/data-source.ts src/database/migrations/<Name>
pnpm typeorm migration:run -d src/data-source.ts
pnpm typeorm migration:revert -d src/data-source.ts
```

> `data-source.ts` points at `dist/**/*.entity.js` and `dist/database/migrations/*.js`, so `pnpm run build` must run before any `pnpm typeorm` invocation. See `workflow.md` at the repo root.

> There is no working e2e setup. `pnpm run test:e2e` points at `test/jest-e2e.json`, but that file was removed; the script is dormant. Add it back if you reintroduce e2e tests.

## Architecture

### Module layout

Seven feature modules plus a `common` layer, a `config` layer, and a global `redis` module.

```
src/
  main.ts                            # bootstrap: CORS, prefix, ValidationPipe, filter, guard, serializer, Swagger
  app.module.ts                      # composes ConfigModule + TypeOrm + Redis + feature modules
  data-source.ts                     # TypeORM DataSource for the CLI (points at dist/)
  config/
    typeorm.config.ts                # TypeOrmModuleAsyncOptions factory (autoLoadEntities + migrations)
    swagger.config.ts                # buildSwaggerConfig() — used by main.ts
  common/
    exceptions/resource-not-found.exception.ts
    filters/http-exception.filter.ts # @Catch() global — shapes all errors as JSON
    dto/error-response.dto.ts        # OpenAPI shape for ErrorResponse
  redis/                             # @Global() ioredis client (REDIS_CLIENT token)
  users/                             # user API
  posts/                             # post API (FeedController, PostsController, UserPostsController)
  comments/                          # comment API (scoped under /posts/:postId/comments and /comments/:id)
  profiles/                          # profile API
  uploads/                           # multipart S3 upload API
  auth/                              # JWT auth (local strategy only; OAuth slot reserved)
  health/                            # liveness/readiness check
  database/migrations/               # TypeORM migrations (numbered <timestamp>-<name>.ts)
```

### Dependency direction (the key thing to understand at a glance)

`PostsModule` and `ProfilesModule` both import `UsersModule`. `AuthModule` also imports `UsersModule`. `CommentsModule` imports `PostsModule`. This is the project's **Dependency Inversion** principle at work: downstream services inject `UsersService` / `PostsService` (abstractions) rather than reaching into a repository directly. The result is that a missing parent (user, post) throws `ResourceNotFoundException` (404) before any child query runs, and lookups are scoped by the parent's id so records can't leak across parents.

`UsersModule` must keep `exports: [UsersService]` for this to work; don't remove it. `PostsModule` exports `PostsService` so `CommentsModule` can call `postsService.findOneById()` to verify a post exists before creating a comment on it.

`RedisModule` is decorated `@Global()`, so any module can inject the `REDIS_CLIENT` token without re-importing. `PostsModule` and `CommentsModule` both inject it directly. (There is no module-level `imports: [RedisModule]` declaration even though the type says they use it — `@Global()` makes that unnecessary.)

### Ownership / authorization pattern

Authorization is **service-level, not route-level**. Routes are flat (`/posts/:id`, `/comments/:id`); the controller's `@CurrentUser()` is passed into the service, which calls `assertOwnership(entity, userId)` and throws `ForbiddenException` (403) if the current user is not the author. The two exceptions are:

- `GET /api/users/:userId/posts` — read-only listing scoped by `:userId`, returns 404 if the user does not exist (calls `usersService.findOne` first).
- `GET /api/posts/:postId/comments` — read-only listing scoped by `:postId`, returns 404 if the post does not exist (calls `postsService.findOneById` first).

### Cross-cutting wiring (set up in `main.ts`)

- CORS: `origin: true` (echoes the incoming Origin — fine for dev), `credentials: true`, methods restricted to `GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS`.
- Global URL prefix: `/api`.
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — this is what strips a spoofed `authorId` from `POST /api/posts`, a spoofed `postId` from `POST /api/posts/:postId/comments`, and a spoofed `passwordHash` from `POST /api/auth/register`. Don't weaken it.
- Global `HttpExceptionFilter` produces a uniform error shape: `{ statusCode, timestamp, path, message }` and logs 5xx via Nest's `Logger`. The shape is mirrored by `ErrorResponseDto` for OpenAPI generation.
- Global `ClassSerializerInterceptor` honors `@Exclude()` on entities. The `User` entity uses `@Exclude({ toPlainOnly: true })` on `passwordHash` so the bcrypt hash never reaches a response — don't remove the interceptor.
- Global `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`) makes every route private by default. Opt out with `@Public()` (used by `HealthController` and `AuthController`). The guard is fully unit-tested in `jwt-auth.guard.spec.ts`.
- `ConfigModule` is global, loads `.env`. All config goes through `ConfigService`; nothing reads `process.env` directly except `main.ts` (port fallback) and `data-source.ts` (TypeORM CLI bootstrap).
- **Swagger**: `buildSwaggerConfig()` from `config/swagger.config.ts` produces a `DocumentBuilder`; `SwaggerModule.createDocument` + `SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true })` serves the UI at `GET /api/docs`. The same document is also written to `<repo>/openapi.json` on every boot for tooling (tests, codegen).

### Caching pattern (Redis)

Read paths cache JSON-serialized entities in Redis under versioned keys. Both `PostsService` and `CommentsService` follow the same shape:

```
posts:v1:user:<userId>:all    TTL 60s    per-user list
posts:v1:post:<id>            TTL 300s   single post
comments:v1:post:<postId>:all TTL 60s    per-post list
comments:v1:comment:<id>      TTL 300s   single comment
```

- Reads try `redis.get(key)` first; a hit short-circuits the DB.
- On miss, after the DB read, the result is written with `redis.set(key, value, 'EX', TTL)`.
- Writes (`create`/`update`/`remove`) call `redis.del(...)` on every key that could be stale. Service-level helpers (`invalidateKeys`) wrap the `del` and log a warning on failure rather than throw.
- All Redis calls are wrapped in `try { ... } catch { logger.warn(...); fall through }` — Redis is best-effort. The DB is the source of truth; a Redis outage degrades latency, not correctness.
- The `FeedController` global feed is **not cached** — writes would have to invalidate a key per `authorId`, and cursor-paginated requests are mostly unique anyway. Add caching later if read traffic justifies it.

### PostsController vs FeedController vs UserPostsController

The posts module has three controllers sharing `PostsService`:

| Controller           | Prefix                          | Notes                                                                                     |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| `FeedController`     | `/posts`                        | `GET /posts/feed` — global cursor-paginated feed. Must be declared first in the module.   |
| `PostsController`    | `/posts`                        | `GET/POST/PATCH/DELETE /posts/:id` — flat CRUD, ownership in service.                     |
| `UserPostsController`| `/users/:userId/posts`          | `GET` only — read-only listing scoped by parent user.                                     |

`FeedController` is registered before `PostsController` in `PostsModule` so the `/posts/feed` literal route wins over `/posts/:id` (the wildcard) during Express route matching.

### Data layer

- TypeORM connection is built by `typeOrmAsyncConfig` in `src/config/typeorm.config.ts`. It reads `DATABASE_URL` (a standard `postgresql://user:pass@host:port/dbname` connection string) from `ConfigService` via `getOrThrow` and passes it as TypeORM's `url` field. The `pg` driver parses the URL itself.
- **`synchronize: false`** — schema changes are applied via TypeORM migrations in `src/database/migrations/`. Entities are auto-loaded (`autoLoadEntities: true`).
- **`migrationsRun` is not set on the runtime DataSource.** Migrations are run explicitly via the CLI in CI (see release workflow) or locally with `pnpm typeorm migration:run -d src/data-source.ts`. Flip `migrationsRun: true` if you want the app to migrate on boot (don't, in production — you want migrate and deploy to be separate steps).
- **Migrations use `data-source.ts`**, not the runtime `typeOrmAsyncConfig`. `data-source.ts` reads from `process.env` directly, sets `synchronize: false`, and points entities/migrations at `dist/**/*.entity.js` and `dist/database/migrations/*.js`. **Always `pnpm run build` before running a `pnpm typeorm` command** — the CLI loads compiled JS, not TS sources.
- Entities use `PrimaryGeneratedColumn('uuid')` — TypeORM generates UUIDs in application code, no Postgres `uuid-ossp` extension required.
- `posts.author_id` has `onDelete: CASCADE` and an index named `idx_posts_author_id`. `comments.post_id` has `onDelete: CASCADE` and an index named `idx_comments_post_id`. `users.email` has a unique index.

### Entity model

- **User** (`users`) — `id`, `email` (unique), `name`, `passwordHash` (`password_hash`, `@Exclude({ toPlainOnly: true })`, `nullable: true`, `select: false`), `createdAt`, `updatedAt`. Relations: `OneToOne Profile`, `OneToMany Post`, `OneToMany Comment`.
- **Profile** (`profiles`) — `id`, `userId` (unique, FK CASCADE), `bio?`, `avatarUrl?`, `location?`, `dateOfBirth?` (ISO date), timestamps. Auto-created on `User` insert by `UserSubscriber` (`src/profiles/subscribers/user.subscriber.ts`).
- **Post** (`posts`) — `id`, `title` (varchar 200), `body` (text), `images` (`text[]`, nullable, populated by the upload flow with S3 URLs), `authorId` (FK CASCADE), timestamps. Relations: `ManyToOne User` (the `author` relation is what responses join on), `OneToMany Comment`.
- **Comment** (`comments`) — `id`, `text` (varchar 200), `authorId` (FK CASCADE), `postId` (FK CASCADE), timestamps. Relations: `ManyToOne User` (`author`), `ManyToOne Post`.

`User → Profile` is 1:1 (a user always has a profile — created by the subscriber — but the `profile?` field is optional in the entity because the row may not exist yet at the moment of the read).

### Auth layer

- `src/auth/` is its own module. `AuthController` exposes `POST /api/auth/register` and `POST /api/auth/login` (both `@Public()`); both return `{ access_token, user: { id, email, name } }`.
- Login identifier is **email** (the existing `users.email` unique column). There is no `username` column.
- Passwords are bcrypt-hashed at cost 12. The plaintext password never touches `UsersService` — hashing lives in `AuthService.register` and comparison in `AuthService.validateUser`.
- Token is a standard HS256 JWT signed with `JWT_SECRET` (read via `ConfigService.getOrThrow`), expiring after `JWT_EXPIRES_IN` (default `1d`). Payload: `{ sub: userId, email }`.
- `JwtStrategy.validate` does **not** re-fetch the user from the DB on every request — it just returns `{ id: payload.sub, email: payload.email }` as `req.user`. Read it via `@CurrentUser()` or `@Req()`.
- `User.passwordHash` is typed `string | null` and column `nullable: true`. Legacy users (created before auth was added) have `null` and cannot log in — they must be re-registered or backfilled by a migration. To harden later, write a one-shot migration to backfill + `SET NOT NULL`, then flip the entity.

### Test conventions

- Specs live next to source as `*.spec.ts`. Jest's `rootDir` is `src/`, `testRegex` is `.*\\.spec\\.ts$`.
- Service specs mock `Repository<T>` via `getRepositoryToken(Entity)` and any cross-module services as plain `useValue` providers. For services that depend on Redis, mock `REDIS_CLIENT` with a `useValue` whose shape covers the methods under test (`get` / `set` / `del` / `ping`). Pattern is consistent across `users.service.spec.ts`, `posts.service.spec.ts`, and `comments.service.spec.ts` — copy that shape for new services.
- Controller specs stub the service with `useValue` and assert that the controller delegates correctly (right method, right args, `@CurrentUser()`'s `id` passed through).
- Guard specs (`jwt-auth.guard.spec.ts`) stub `Reflector.getAllAndOverride` and assert the `@Public()` short-circuit vs. the fallback to `AuthGuard('jwt').canActivate`.

### Local infrastructure

`docker-compose.yml` provisions both services for local dev:

```bash
docker compose up -d       # postgres on 5432, redis on 6379
```

`.env.example` lists every variable `ConfigService.getOrThrow` reads: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REDIS_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, and the optional `AWS_S3_ENDPOINT` (set to a MinIO/LocalStack URL to point uploads at a local S3).

### CI / CD

Four workflows in `.github/workflows/`. All build with pnpm 9 + Node 22. All authenticate to GCP via **Workload Identity Federation** (the `google-github-actions/auth@v2` action reads `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` secrets). Images are pushed to **Google Artifact Registry** at `asia-southeast3-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/meetworld/backend`. Deploys target three Cloud Run services in the same GCP project, region `asia-southeast3`: `meetworld-backend-dev`, `meetworld-backend-staging`, `meetworld-backend-prod`.

| Workflow | Trigger | Concurrency | Environments used |
|---|---|---|---|
| `ci.yml` | PR + push to `dev`, `main` | cancel in-flight on same ref | none |
| `deploy-dev.yml` | push to `dev` (also `workflow_dispatch`) | cancel in-flight on same ref | `dev` |
| `deploy-staging.yml` | push to `main` (also `workflow_dispatch`) | cancel in-flight on same ref | `staging` |
| `deploy-production.yml` | push tag matching `v*.*.*` | `prod-<tag>`, **never cancel** | `production-migrate`, `production-deploy` |

#### Job shape (shared across the three deploy workflows)

```
build-and-push  →  migrate  →  deploy
   (no env)       (env)       (env)
```

- **`build-and-push`** — builds the multi-stage `Dockerfile`, pushes two tags: `<env>` and `<env>-<short-sha>` (prod uses the actual tag name and `latest` instead). GHA cache. No environment gate.
- **`migrate`** — runs `pnpm typeorm migration:run -d src/data-source.ts`. `data-source.ts` reads `DATABASE_URL` via `dotenv/config`, which the workflow passes inline. Schema changes go in **before** the new code ships.
- **`deploy`** — `gcloud run deploy <service> --image=<image>:<tag> --region=asia-southeast3 --platform=managed --allow-unauthenticated`. Service-level env vars (`JWT_SECRET`, `REDIS_URL`, `AWS_*`, etc. from `.env.example`) are configured on each Cloud Run service and are **not** set by the workflow — don't add `--update-env-vars` to the deploy step or you will wipe them.

#### Production gates

Two separate GitHub environments so the two approval blocks can have different required reviewer teams:

1. **`production-migrate`** — gates `migrate-prod`. Suggested reviewers: data / DBA team. This is the gate that catches destructive migrations before they touch the prod DB.
2. **`production-deploy`** — gates `deploy-prod` and depends on `migrate-prod` succeeding. Suggested reviewers: release managers / SRE. Approving this means the new revision rolls out to live traffic.

`production-deploy` is intentionally a separate environment from `production-migrate` so the two gates can have independent reviewer lists and the second gate is meaningful (not just rubber-stamping the first).

A release is triggered by pushing a `v*.*.*` tag from `main` after the change has been verified in staging:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow picks up the tag verbatim via `github.ref_name` and uses it as the image tag. Re-tagging while a release is in flight queues a second run (concurrency `cancel-in-progress: false`) instead of killing the in-flight one — different tag releases run independently.

#### Rollback

Promote the previous Cloud Run revision to 100% traffic:

```bash
gcloud run services update-traffic meetworld-backend-prod \
  --to-revisions=<previous-revision-name>=100 \
  --region=asia-southeast3
```

This is immediate and does not require a new image build. To roll back AND cut a new release, re-tag and push the previous good commit (`git tag v1.0.1 <sha> && git push origin v1.0.1`) — the existing production workflow handles it.

#### GitHub-side setup (one-time)

- **Repository variable** `GCP_PROJECT_ID` (the GCP project that owns the registry and Cloud Run services).
- **Repository secrets** shared across environments: `GCP_WORKLOAD_IDENTITY_PROVIDER` (the WIF provider resource name) and `GCP_SERVICE_ACCOUNT` (the SA email bound to it).
- **Per-environment secret** `DATABASE_URL` — one connection string per environment, pointing at that environment's database.
- **Environments** (Settings → Environments):
  - `dev` — no required reviewers, deployment branch `dev`.
  - `staging` — no required reviewers, deployment branch `main`.
  - `production-migrate` — required reviewers, deployment tags `v*.*.*`.
  - `production-deploy` — required reviewers, deployment tags `v*.*.*`.

The legacy `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `GCP_SA_KEY` secrets are no longer used by any workflow — delete them from the repo once the new pipeline is verified.

### Things that aren't here yet

- **No Google / OAuth provider.** `AuthService.validateUser` is the seam; a second strategy file + a new service method is all that should be needed.
- **No e2e tests.** The script is dormant; the config was removed.
- **No rate limiting / throttling.** The Redis client is already in place if you want to add `@nestjs/throttler`'s Redis storage.
- **No comment likes / shares** — the entity has commented-out `likes` / `shares` columns and a `Test…` migration pair that adds then drops them. Don't rely on those columns.
