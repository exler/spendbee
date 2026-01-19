import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { env } from "$env/dynamic/private";

const dbPath = env.DATABASE_URL || "./spendbee.db";
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
