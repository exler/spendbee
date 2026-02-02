import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups, notifications, users, invitationTokens } from "$lib/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { emailService } from "$lib/server/services/email";
import { env } from "$env/dynamic/private";

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.id;

    try {
        // First, find the group by UUID to get its ID
        const group = await db.query.groups.findFirst({
            where: eq(groups.uuid, groupUuid),
            with: {
                creator: true,
            },
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        const body = await event.request.json();
        const { email } = body;

        if (!email) {
            return json({ error: "Email is required" }, { status: 400 });
        }

        const inviter = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        // Check if user exists
        const invitedUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        const appUrl = env.PUBLIC_APP_URL || "http://localhost:5173";

        if (invitedUser) {
            // User already exists - use existing flow (in-app notification)
            const existingMember = await db.query.groupMembers.findFirst({
                where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, invitedUser.id)),
            });

            if (existingMember) {
                return json({ error: "User is already a member of this group" }, { status: 400 });
            }

            const existingInvite = await db.query.notifications.findFirst({
                where: and(
                    eq(notifications.userId, invitedUser.id),
                    eq(notifications.type, "group_invite"),
                    sql`json_extract(${notifications.data}, '$.groupUuid') = ${groupUuid}`,
                ),
            });

            if (existingInvite) {
                return json({ error: "User already has a pending invitation" }, { status: 400 });
            }

            const [notification] = await db
                .insert(notifications)
                .values({
                    userId: invitedUser.id,
                    type: "group_invite",
                    title: "Group Invitation",
                    message: `${inviter?.name} invited you to join "${group?.name}"`,
                    data: JSON.stringify({ groupUuid, invitedBy: userId }),
                })
                .returning();

            // Send email invitation for existing user
            const acceptUrl = `${appUrl}/api/notifications/${notification.id}/accept`;

            try {
                await emailService.sendGroupInvitation({
                    to: invitedUser.email,
                    inviterName: inviter?.name || "Someone",
                    groupName: group.name,
                    acceptUrl,
                    isNewUser: false,
                });
            } catch (emailError) {
                console.error("Failed to send invitation email:", emailError);
                // Don't fail the invitation if email fails - notification is already created
            }

            return json({ success: true, existingUser: true });
        }
        // New user - create invitation token
        // Check if there's already a pending invitation for this email
        const existingToken = await db.query.invitationTokens.findFirst({
            where: and(
                eq(invitationTokens.email, email),
                eq(invitationTokens.groupId, group.id),
                eq(invitationTokens.used, false),
            ),
        });

        if (existingToken) {
            return json({ error: "An invitation has already been sent to this email" }, { status: 400 });
        }

        // Create invitation token (expires in 7 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const [token] = await db
            .insert(invitationTokens)
            .values({
                email,
                groupId: group.id,
                invitedBy: userId,
                expiresAt,
            })
            .returning();

        // Send email invitation for new user
        const signupUrl = `${appUrl}/register?token=${token.token}`;

        try {
            await emailService.sendGroupInvitation({
                to: email,
                inviterName: inviter?.name || "Someone",
                groupName: group.name,
                acceptUrl: signupUrl,
                isNewUser: true,
            });
        } catch (emailError) {
            console.error("Failed to send invitation email:", emailError);
            // Delete the token if email fails
            await db.delete(invitationTokens).where(eq(invitationTokens.id, token.id));
            return json({ error: "Failed to send invitation email" }, { status: 500 });
        }

        return json({ success: true, existingUser: false });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to send invitation" }, { status: 500 });
    }
};
