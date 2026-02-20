import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { sql } from "drizzle-orm";

export const GET: RequestHandler = async () => {
    try {
        // Simple database connectivity check
        // Try to execute a basic query to verify database is accessible
        await db.select({ count: sql`count(*)` }).from(users);

        return json({
            status: "ok",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return json(
            {
                status: "error",
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 503 },
        );
    }
};
