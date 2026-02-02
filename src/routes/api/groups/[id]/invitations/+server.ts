import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups, notifications, invitationTokens, users } from "$lib/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { gt } from "drizzle-orm/mysql-core/expressions";

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.id;

    try {
        // First, find the group by UUID to get its ID
        const group = await db.query.groups.findFirst({
            where: eq(groups.uuid, groupUuid),
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        // Check if user is a member of the group
        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Fetch pending invitations for existing users (via notifications)
        const pendingNotifications = await db
            .select({
                id: notifications.id,
                email: users.email,
                invitedBy: sql<number>`CAST(json_extract(${notifications.data}, '$.invitedBy') AS INTEGER)`,
                createdAt: notifications.createdAt,
                type: sql<string>`'notification'`,
            })
            .from(notifications)
            .innerJoin(users, eq(users.id, notifications.userId))
            .where(
                and(
                    eq(notifications.type, "group_invite"),
                    sql`json_extract(${notifications.data}, '$.groupUuid') = ${groupUuid}`,
                ),
            );

        // Fetch pending invitations for new users (via invitation tokens)
        const now = Date.now();
        const pendingTokens = await db
            .select({
                id: invitationTokens.id,
                email: invitationTokens.email,
                invitedBy: invitationTokens.invitedBy,
                createdAt: invitationTokens.createdAt,
                type: sql<string>`'token'`,
            })
            .from(invitationTokens)
            .where(
                and(
                    eq(invitationTokens.groupId, group.id),
                    eq(invitationTokens.used, false),
                    gt(invitationTokens.expiresAt, new Date(now)),
                ),
            );

        // Combine both types of invitations
        const allInvitations = [...pendingNotifications, ...pendingTokens];

        // Fetch inviter details for all invitations
        const inviterIds = [...new Set(allInvitations.map((inv) => inv.invitedBy))];
        let inviterMap = new Map();

        if (inviterIds.length > 0) {
            const inviters = await db
                .select()
                .from(users)
                .where(sql`${users.id} IN (${sql.join(inviterIds, sql`, `)})`);
            inviterMap = new Map(inviters.map((u) => [u.id, u]));
        }

        // Format the response
        const formattedInvitations = allInvitations.map((inv) => {
            const inviter = inviterMap.get(inv.invitedBy);
            return {
                id: inv.id,
                email: inv.email,
                type: inv.type,
                invitedBy: {
                    id: inviter?.id,
                    name: inviter?.name,
                    email: inviter?.email,
                },
                createdAt: inv.createdAt,
            };
        });

        return json(formattedInvitations);
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to fetch invitations" }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.id;

    try {
        const body = await event.request.json();
        const { invitationId, type } = body;

        if (!invitationId || !type) {
            return json({ error: "Invitation ID and type are required" }, { status: 400 });
        }

        // First, find the group by UUID to get its ID
        const group = await db.query.groups.findFirst({
            where: eq(groups.uuid, groupUuid),
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        // Check if user is a member of the group
        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Revoke the invitation based on type
        if (type === "notification") {
            // Verify the notification belongs to this group
            const notification = await db.query.notifications.findFirst({
                where: and(
                    eq(notifications.id, invitationId),
                    eq(notifications.type, "group_invite"),
                    sql`json_extract(${notifications.data}, '$.groupUuid') = ${groupUuid}`,
                ),
            });

            if (!notification) {
                return json({ error: "Invitation not found" }, { status: 404 });
            }

            await db.delete(notifications).where(eq(notifications.id, invitationId));
        } else if (type === "token") {
            // Verify the token belongs to this group
            const token = await db.query.invitationTokens.findFirst({
                where: and(eq(invitationTokens.id, invitationId), eq(invitationTokens.groupId, group.id)),
            });

            if (!token) {
                return json({ error: "Invitation not found" }, { status: 404 });
            }

            await db.delete(invitationTokens).where(eq(invitationTokens.id, invitationId));
        } else {
            return json({ error: "Invalid invitation type" }, { status: 400 });
        }

        return json({ success: true });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to revoke invitation" }, { status: 500 });
    }
};
