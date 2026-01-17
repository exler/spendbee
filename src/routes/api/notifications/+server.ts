import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { notifications } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const userId = event.locals.userId!;

	const userNotifications = await db.query.notifications.findMany({
		where: eq(notifications.userId, userId),
		orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
	});

	return json(userNotifications);
};
