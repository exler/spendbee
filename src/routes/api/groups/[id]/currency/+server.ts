import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groups } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const PATCH: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupId = Number.parseInt(event.params.id);

    try {
        const group = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        if (group.createdBy !== userId) {
            return json({ error: "Only group creator can change base currency" }, { status: 403 });
        }

        const body = await event.request.json();
        await db.update(groups).set({ baseCurrency: body.baseCurrency }).where(eq(groups.id, groupId));

        return json({ success: true });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to update base currency" }, { status: 500 });
    }
};
