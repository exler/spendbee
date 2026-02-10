import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { env } from "$env/dynamic/private";

const dbPath = env.DATABASE_URL || "./spendbee.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA foreign_keys = ON;");
sqlite.exec("PRAGMA busy_timeout = 5000;");
export const db = drizzle(sqlite, { schema });
