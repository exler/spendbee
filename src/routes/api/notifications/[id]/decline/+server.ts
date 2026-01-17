import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { notifications } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
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

        // Delete notification
        await db.delete(notifications).where(eq(notifications.id, notificationId));

        return json({ success: true });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to decline invitation" }, { status: 500 });
    }
};
