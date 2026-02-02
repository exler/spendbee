import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const DELETE: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.groupId;
    const memberId = Number.parseInt(event.params.memberId);

    try {
        // First, find the group by UUID to get its ID
        const group = await db.query.groups.findFirst({
            where: eq(groups.uuid, groupUuid),
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        const memberToDelete = await db.query.groupMembers.findFirst({
            where: eq(groupMembers.id, memberId),
        });

        if (!memberToDelete || memberToDelete.groupId !== group.id) {
            return json({ error: "Member not found" }, { status: 404 });
        }

        if (memberToDelete.userId !== null) {
            return json({ error: "Cannot delete registered members" }, { status: 400 });
        }

        await db.delete(groupMembers).where(eq(groupMembers.id, memberId));

        return json({ success: true });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to delete guest member" }, { status: 500 });
    }
};
