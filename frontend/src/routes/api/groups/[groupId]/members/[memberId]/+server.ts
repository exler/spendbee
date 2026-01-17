import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const DELETE: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const userId = event.locals.userId!;
	const groupId = Number.parseInt(event.params.groupId);
	const memberId = Number.parseInt(event.params.memberId);

	try {
		const membership = await db.query.groupMembers.findFirst({
			where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
		});

		if (!membership) {
			return json({ error: "Not a member of this group" }, { status: 403 });
		}

		const memberToDelete = await db.query.groupMembers.findFirst({
			where: eq(groupMembers.id, memberId),
		});

		if (!memberToDelete || memberToDelete.groupId !== groupId) {
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
