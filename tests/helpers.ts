import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import * as schema from "../src/lib/server/db/schema";

let db: ReturnType<typeof drizzle> | null = null;
let sqlite: Database | null = null;
let dbPath: string | null = null;

export function setupTestDb() {
    dbPath = `/tmp/spendbee-test-${randomUUID()}.db`;
    process.env.DATABASE_URL = dbPath;
    process.env.JWT_SECRET = "test-secret";

    sqlite = new Database(dbPath);
    sqlite.exec("PRAGMA foreign_keys = ON;");
    sqlite.exec("PRAGMA busy_timeout = 5000;");

    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "./drizzle" });

    return { dbPath };
}

export function getDb() {
    if (!db) {
        throw new Error("Test database has not been initialized. Call setupTestDb() first.");
    }
    return db;
}

export function resetDb() {
    if (!sqlite) {
        throw new Error("Test database has not been initialized. Call setupTestDb() first.");
    }

    sqlite.exec("PRAGMA foreign_keys = OFF;");
    sqlite.exec("DELETE FROM expense_shares;");
    sqlite.exec("DELETE FROM expenses;");
    sqlite.exec("DELETE FROM settlements;");
    sqlite.exec("DELETE FROM activities;");
    sqlite.exec("DELETE FROM invitation_tokens;");
    sqlite.exec("DELETE FROM notifications;");
    sqlite.exec("DELETE FROM group_members;");
    sqlite.exec("DELETE FROM groups;");
    sqlite.exec("DELETE FROM users;");
    sqlite.exec("PRAGMA foreign_keys = ON;");
}

export function teardownTestDb() {
    sqlite?.close();
    if (dbPath && existsSync(dbPath)) {
        unlinkSync(dbPath);
    }
    sqlite = null;
    db = null;
    dbPath = null;
}

type EventOptions = {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
    userId?: number | null;
    url?: string;
};

export function createEvent({
    method = "POST",
    body,
    params = {},
    userId = null,
    url = "http://localhost",
}: EventOptions) {
    const headers: Record<string, string> = {};
    let requestBody: string | undefined;

    if (body !== undefined) {
        headers["content-type"] = "application/json";
        requestBody = JSON.stringify(body);
    }

    const request = new Request(url, {
        method,
        headers,
        body: requestBody,
    });

    const cookies = {
        calls: [] as unknown[],
        set: (...args: unknown[]) => {
            cookies.calls.push(args);
        },
    };

    return {
        request,
        params,
        locals: { userId },
        url: new URL(url),
        cookies,
    };
}
