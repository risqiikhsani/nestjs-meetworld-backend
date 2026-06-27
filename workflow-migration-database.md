# Migrations

`src/data-source.ts` points entities at `dist/**/*.entity.js` and migrations at `dist/database/migrations/*.js`, so **`pnpm run build` must run before every `pnpm typeorm` command**. The CLI loads compiled JS, not TS sources. If you skip the build, TypeORM operates against a stale `dist/` and you'll get "no entity / no migration found" errors.

## Create a new migration

After changing an entity, generate the diff against the current DB:

```bash
pnpm build
pnpm typeorm migration:generate -d src/data-source.ts src/database/migrations/<Name>
```

Open the generated file, review the SQL (auto-generated diffs sometimes need cleanup), then build again and run it:

```bash
pnpm build
pnpm typeorm migration:run -d src/data-source.ts
```

`Name` should be a short, present-tense label — e.g. `AddLikes`, `AddImageToPost`, `RenameUserColumn`. The file gets a timestamp prefix automatically (`<timestamp>-<Name>.ts`).

## Apply pending migrations

```bash
pnpm build
pnpm typeorm migration:run -d src/data-source.ts
```

TypeORM compares the filenames in `src/database/migrations/` to the rows in the `migrations` table and applies anything missing, in timestamp order.

## Revert the last migration

```bash
pnpm build
pnpm typeorm migration:revert -d src/data-source.ts
```

Re-runs the `down()` of the most recent applied migration.

## Reset a corrupted local DB

If the `migrations` table contains rows for migrations that no longer exist in source (a common foot-gun if you ever ran an ad-hoc `migration:generate ... test` and deleted the file), TypeORM will see every source migration as "new" and try to replay them — failing on the first `CREATE TABLE` whose table already exists. Fix:

```bash
pnpm build
pnpm typeorm schema:drop -d src/data-source.ts
pnpm typeorm migration:run -d src/data-source.ts
```

`schema:drop` removes every table in the public schema — **including the `migrations` tracking table** — so the subsequent `migration:run` replays every migration from `src/database/migrations/` in timestamp order on a clean slate. Use this freely on local dev databases; never on production.

## Why not the alternatives?

The two patterns below appear in some TypeORM tutorials but each has a caveat that bites this setup:

- **`schema:sync`** brings the DB schema in line with the entities but does **not** update the `migrations` table. The next `migration:run` will still see `InitialBaseline` as pending and crash on `CREATE TABLE "comments"`. `schema:sync` is a fine one-off sync, but it does not by itself fix a corrupted `migrations` table.
- **Re-generating `InitialBaseline`** errors if `src/database/migrations/InitialBaseline*.ts` already exists, and even if it didn't, the generated diff would still try to `CREATE TABLE` rows that are already there.

For a local DB that's drifted from source, `schema:drop` + `migration:run` is the only one-shot fix.

## Inspecting state

```bash
# list applied migrations
psql "$DATABASE_URL" -c 'SELECT * FROM migrations ORDER BY id;'

# list all tables in the public schema
psql "$DATABASE_URL" -c '\dt'
```