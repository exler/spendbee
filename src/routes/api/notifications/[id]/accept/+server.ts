import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, notifications } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const notificationId = Number.parseInt(event.params.id);

    try {
        const notification = await db.query.notifications.findFirst({
            where: eq(notifications.id, notificationId),
        });

        if (!notification || notification.userId !== userId) {
            return json({ error: "Notification not found" }, { status: 404 });
        }

        if (notification.type !== "group_invite") {
            return json({ error: "Invalid notification type" }, { status: 400 });
        }

        const data = JSON.parse(notification.data || "{}");
        const groupId = data.groupId;

        // Check if already a member
        const existingMember = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (existingMember) {
            // Delete notification and return success
            await db.delete(notifications).where(eq(notifications.id, notificationId));
            return json({ success: true });
        }

        // Add user to group
        await db.insert(groupMembers).values({
            groupId: groupId,
            userId: userId,
        });

        // Delete notification
        await db.delete(notifications).where(eq(notifications.id, notificationId));

        return json({ success: true, groupId });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to accept invitation" }, { status: 500 });
    }
};
