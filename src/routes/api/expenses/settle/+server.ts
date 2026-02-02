import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, settlements } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, checkGroupArchived } from "$lib/server/utils";

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
        const body = await event.request.json();
        const { groupId, fromMemberId, toMemberId, amount, currency } = body;

        if (!groupId || !fromMemberId || !toMemberId || !amount) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Check if group is archived
        const isArchived = await checkGroupArchived(groupId);
        if (isArchived) {
            return json(
                { error: "Cannot settle debts in archived groups. Please unarchive the group first." },
                { status: 403 },
            );
        }

        const [settlement] = await db
            .insert(settlements)
            .values({
                groupId,
                fromMemberId,
                toMemberId,
                amount,
                currency: currency || "EUR",
            })
            .returning();

        return json(settlement);
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to record settlement" }, { status: 500 });
    }
};
