import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups, notifications, users } from "$lib/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

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
		const { email } = body;

		const invitedUser = await db.query.users.findFirst({
			where: eq(users.email, email),
		});

		if (!invitedUser) {
			return json({ error: "User not found" }, { status: 404 });
		}

		const existingMember = await db.query.groupMembers.findFirst({
			where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, invitedUser.id)),
		});

		if (existingMember) {
			return json({ error: "User is already a member of this group" }, { status: 400 });
		}

		const existingInvite = await db.query.notifications.findFirst({
			where: and(
				eq(notifications.userId, invitedUser.id),
				eq(notifications.type, "group_invite"),
				sql`json_extract(${notifications.data}, '$.groupId') = ${groupId}`,
			),
		});

		if (existingInvite) {
			return json({ error: "User already has a pending invitation" }, { status: 400 });
		}

		const group = await db.query.groups.findFirst({
			where: eq(groups.id, groupId),
			with: {
				creator: true,
			},
		});

		const inviter = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		await db.insert(notifications).values({
			userId: invitedUser.id,
			type: "group_invite",
			title: "Group Invitation",
			message: `${inviter?.name} invited you to join "${group?.name}"`,
			data: JSON.stringify({ groupId, invitedBy: userId }),
		});

		return json({ success: true });
	} catch (error) {
		console.error(error);
		return json({ error: "Failed to send invitation" }, { status: 500 });
	}
};
