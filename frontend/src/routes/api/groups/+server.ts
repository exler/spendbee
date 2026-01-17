import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const userId = event.locals.userId!;

	const userGroups = await db.query.groupMembers.findMany({
		where: eq(groupMembers.userId, userId),
		with: {
			group: {
				with: {
					creator: {
						columns: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			},
		},
	});

	return json(userGroups.map((gm) => gm.group));
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const userId = event.locals.userId!;

	try {
		const body = await event.request.json();
		const { name, description, baseCurrency } = body;

		if (!name || name.length < 1) {
			return json({ error: "Name is required" }, { status: 400 });
		}

		const [group] = await db
			.insert(groups)
			.values({
				name,
				description: description || null,
				baseCurrency: baseCurrency || "EUR",
				createdBy: userId,
			})
			.returning();

		await db.insert(groupMembers).values({
			groupId: group.id,
			userId: userId,
		});

		return json(group);
	} catch (error) {
		console.error(error);
		return json({ error: "Failed to create group" }, { status: 500 });
	}
};
