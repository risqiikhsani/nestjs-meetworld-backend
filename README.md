 To run locally:
  cp .env.example .env
  docker run --name meetworld-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=meetworld -p 5432:5432 -d postgres:16
  pnpm run start:dev
  synchronize: true will create the tables on first boot. Flip it off (and add migrations) before any real deployment.