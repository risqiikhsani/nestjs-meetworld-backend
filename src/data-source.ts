import 'dotenv/config';
import { DataSource } from 'typeorm';
import path from 'path';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // Use process.cwd() to build an absolute path cleanly in both ESM and CJS
  // entities: [path.join(process.cwd(), '**/*.entity{.ts,.js}')],
  // migrations: [path.join(process.cwd(), 'src/database/migrations/*.{ts,js}')],
  // Point to compilation output folder (dist) so TypeORM CLI can read compiled JavaScript
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  migrationsRun: false,
  migrationsTableName: 'migrations',
  migrationsTransactionMode: 'all',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
