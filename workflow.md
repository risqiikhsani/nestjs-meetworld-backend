the migrations and entities set on data-source is in /dist

so we have to pnpm build everytime before running these commands

pnpm typeorm migration:generate -d src/data-source.ts src/database/migrations/test
pnpm typeorm migration:run -d src/data-source.ts 