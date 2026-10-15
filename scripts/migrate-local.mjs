// Local test database bootstrap. Production uses prisma migrate deploy.
import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query(
  await readFile(
    "prisma/migrations/20261015000000_initial/migration.sql",
    "utf8",
  ),
);
await c.end();
