the migrations and entities set on data-source is in /dist

so we have to pnpm build everytime before running these commands

# HOW TO MIGRATION

pnpm build
pnpm typeorm migration:generate -d src/data-source.ts src/database/migrations/test
pnpm build
pnpm typeorm migration:run -d src/data-source.ts 

# FIX OUT OF ORDER MIGRATION:

pnpm build
pnpm typeorm schema:sync -d src/data-source.ts

OR

pnpm build
pnpm typeorm migration:generate src/database/migrations/InitialBaseline -d src/data-source.ts

# how to drop database:

pnpm build
pnpm typeorm schema:drop -d src/data-source.ts
