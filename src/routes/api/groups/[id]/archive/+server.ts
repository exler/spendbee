import { json, type RequestEvent } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const PATCH = async (event: RequestEvent) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId;
    const groupId = Number.parseInt(event.params.id!);

    try {
        const group = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        if (group.createdBy !== userId) {
            return json({ error: "Only group creator can archive/unarchive groups" }, { status: 403 });
        }

        const body = await event.request.json();
        const { archived } = body;

        if (typeof archived !== "boolean") {
            return json({ error: "archived field must be a boolean" }, { status: 400 });
        }

        await db.update(groups).set({ archived }).where(eq(groups.id, groupId));

        return json({ success: true, archived });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to update group archive status" }, { status: 500 });
    }
};
