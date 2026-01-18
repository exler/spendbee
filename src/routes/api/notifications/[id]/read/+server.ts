import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { notifications } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const PATCH: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId;
    const notificationId = Number.parseInt(event.params.id);

    const notification = await db.query.notifications.findFirst({
        where: eq(notifications.id, notificationId),
    });

    if (!notification || notification.userId !== userId) {
        return json({ error: "Notification not found" }, { status: 404 });
    }

    await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));

    return json({ success: true });
};
