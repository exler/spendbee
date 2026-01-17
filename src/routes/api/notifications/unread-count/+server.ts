import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { notifications } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const userId = event.locals.userId!;

	const unreadNotifications = await db.query.notifications.findMany({
		where: and(eq(notifications.userId, userId), eq(notifications.read, false)),
	});

	return json({ count: unreadNotifications.length });
};
