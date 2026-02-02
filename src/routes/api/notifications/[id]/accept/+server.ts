import { json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups, notifications } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

async function acceptInvitation(notificationId: number, userId: number) {
    const notification = await db.query.notifications.findFirst({
        where: eq(notifications.id, notificationId),
    });

    if (!notification || notification.userId !== userId) {
        return { error: "Notification not found", status: 404 };
    }

    if (notification.type !== "group_invite") {
        return { error: "Invalid notification type", status: 400 };
    }

    const data = JSON.parse(notification.data || "{}");
    const groupUuid = data.groupUuid;

    if (!groupUuid) {
        return { error: "Invalid invitation data", status: 400 };
    }

    // Find the group by UUID to get its ID
    const group = await db.query.groups.findFirst({
        where: eq(groups.uuid, groupUuid),
    });

    if (!group) {
        return { error: "Group not found", status: 404 };
    }

    // Check if already a member
    const existingMember = await db.query.groupMembers.findFirst({
        where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
    });

    if (existingMember) {
        // Delete notification and return success
        await db.delete(notifications).where(eq(notifications.id, notificationId));
        return { success: true, groupUuid };
    }

    // Add user to group
    await db.insert(groupMembers).values({
        groupId: group.id,
        userId: userId,
    });

    // Delete notification
    await db.delete(notifications).where(eq(notifications.id, notificationId));

    return { success: true, groupUuid };
}

// Handle GET requests from email links
export const GET: RequestHandler = async (event) => {
    const userId = event.locals.userId;
    const notificationId = Number.parseInt(event.params.id);

    // If not authenticated, redirect to login with return URL
    if (!userId) {
        const returnUrl = `/api/notifications/${notificationId}/accept`;
        return redirect(302, `/login?redirect=${encodeURIComponent(returnUrl)}`);
    }

    try {
        const result = await acceptInvitation(notificationId, userId);

        if ("error" in result) {
            // Redirect to home with error message
            return redirect(302, `/?error=${encodeURIComponent(result.error || "Unknown error")}`);
        }

        // Redirect to the group page on success
        return redirect(302, `/groups/${result.groupUuid}`);
    } catch (error) {
        console.error(error);
        return redirect(302, "/?error=Failed to accept invitation");
    }
};

// Handle POST requests from web UI
export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const notificationId = Number.parseInt(event.params.id);

    try {
        const result = await acceptInvitation(notificationId, userId);

        if ("error" in result) {
            return json({ error: result.error }, { status: result.status });
        }

        return json(result);
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to accept invitation" }, { status: 500 });
    }
};
