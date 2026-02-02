import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

export function requireAuth(event: RequestEvent) {
    if (!event.locals.userId) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
}

export async function checkGroupArchived(groupId: number) {
    const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
        columns: {
            archived: true,
        },
    });
    return group?.archived ?? false;
}
