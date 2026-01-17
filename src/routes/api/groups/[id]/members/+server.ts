import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const userId = event.locals.userId!;
	const groupId = Number.parseInt(event.params.id);

	const membership = await db.query.groupMembers.findFirst({
		where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
	});

	if (!membership) {
		return json({ error: "Not a member of this group" }, { status: 403 });
	}

	const members = await db.query.groupMembers.findMany({
		where: eq(groupMembers.groupId, groupId),
		with: {
			user: {
				columns: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
	});

	return json(members);
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const userId = event.locals.userId!;
	const groupId = Number.parseInt(event.params.id);

	try {
		const membership = await db.query.groupMembers.findFirst({
			where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
		});

		if (!membership) {
			return json({ error: "Not a member of this group" }, { status: 403 });
		}

		const body = await event.request.json();
		const { name } = body;

		if (!name || name.length < 1) {
			return json({ error: "Name is required" }, { status: 400 });
		}

		const [member] = await db
			.insert(groupMembers)
			.values({
				groupId: groupId,
				userId: null,
				name: name,
				joinedAt: new Date(),
			})
			.returning();

		return json(member);
	} catch (error) {
		console.error(error);
		return json({ error: "Failed to add guest member" }, { status: 500 });
	}
};
