import { and, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db";
import { groupMembers, groups, users } from "../db/schema";
import { SUPPORTED_CURRENCIES } from "../services/currency";

export const groupRoutes = new Elysia({ prefix: "/groups" })
    .get("/currencies", () => {
        return { currencies: SUPPORTED_CURRENCIES };
    })
    .derive(async ({ headers, set }) => {
        const authHeader = headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            throw new Error("Unauthorized");
        }

        const token = authHeader.substring(7);

        try {
            const jwt = await import("@elysiajs/jwt").then((m) =>
                m.jwt({
                    name: "jwt",
                    secret: process.env.JWT_SECRET || "spendbee-secret-key-change-in-production",
                }),
            );

            const payload = (await jwt.decorator.jwt.verify(token)) as { userId: number };

            if (!payload || !payload.userId) {
                set.status = 401;
                throw new Error("Invalid token");
            }

            return { userId: payload.userId };
        } catch {
            set.status = 401;
            throw new Error("Invalid token");
        }
    })
    .post(
        "/",
        async ({ body, userId, set }) => {
            try {
                const [group] = await db
                    .insert(groups)
                    .values({
                        name: body.name,
                        description: body.description,
                        baseCurrency: body.baseCurrency || "EUR",
                        createdBy: userId,
                    })
                    .returning();

                await db.insert(groupMembers).values({
                    groupId: group.id,
                    userId: userId,
                });

                return group;
            } catch (error) {
                console.error(error);
                set.status = 500;
                return { error: "Failed to create group" };
            }
        },
        {
            body: t.Object({
                name: t.String({ minLength: 1 }),
                description: t.Optional(t.String()),
                baseCurrency: t.Optional(t.String()),
            }),
        },
    )
    .get("/", async ({ userId }) => {
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

        return userGroups.map((gm) => gm.group);
    })
    .get("/:id", async ({ params, userId, set }) => {
        const groupId = parseInt(params.id);

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            set.status = 403;
            return { error: "Not a member of this group" };
        }

        const group = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
            with: {
                creator: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                members: {
                    with: {
                        user: {
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

        return group;
    })
    .post(
        "/:id/invite",
        async ({ params, body, userId, set }) => {
            try {
                const groupId = parseInt(params.id);

                // Check if user is a member of the group
                const membership = await db.query.groupMembers.findFirst({
                    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
                });

                if (!membership) {
                    set.status = 403;
                    return { error: "Not a member of this group" };
                }

                // Find user by email
                const { users } = await import("../db/schema");
                const invitedUser = await db.query.users.findFirst({
                    where: eq(users.email, body.email),
                });

                if (!invitedUser) {
                    set.status = 404;
                    return { error: "User not found" };
                }

                // Check if already a member
                const existingMember = await db.query.groupMembers.findFirst({
                    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, invitedUser.id)),
                });

                if (existingMember) {
                    set.status = 400;
                    return { error: "User is already a member of this group" };
                }

                // Check if already invited
                const { notifications } = await import("../db/schema");
                const existingInvite = await db.query.notifications.findFirst({
                    where: and(
                        eq(notifications.userId, invitedUser.id),
                        eq(notifications.type, "group_invite"),
                        sql`json_extract(${notifications.data}, '$.groupId') = ${groupId}`,
                    ),
                });

                if (existingInvite) {
                    set.status = 400;
                    return { error: "User already has a pending invitation" };
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

                // Create notification
                await db.insert(notifications).values({
                    userId: invitedUser.id,
                    type: "group_invite",
                    title: "Group Invitation",
                    message: `${inviter?.name} invited you to join "${group?.name}"`,
                    data: JSON.stringify({ groupId, invitedBy: userId }),
                });

                return { success: true };
            } catch (error) {
                console.error(error);
                set.status = 500;
                return { error: "Failed to send invitation" };
            }
        },
        {
            body: t.Object({
                email: t.String(),
            }),
        },
    )
    .patch(
        "/:id",
        async ({ params, body, userId, set }) => {
            try {
                const groupId = parseInt(params.id);

                const group = await db.query.groups.findFirst({
                    where: eq(groups.id, groupId),
                });

                if (!group) {
                    set.status = 404;
                    return { error: "Group not found" };
                }

                if (group.createdBy !== userId) {
                    set.status = 403;
                    return { error: "Only group creator can update group settings" };
                }

                const updates: any = {};
                if (body.name !== undefined) updates.name = body.name;
                if (body.description !== undefined) updates.description = body.description;
                if (body.baseCurrency !== undefined) updates.baseCurrency = body.baseCurrency;

                await db.update(groups).set(updates).where(eq(groups.id, groupId));

                return { success: true };
            } catch (error) {
                console.error(error);
                set.status = 500;
                return { error: "Failed to update group" };
            }
        },
        {
            body: t.Object({
                name: t.Optional(t.String({ minLength: 1 })),
                description: t.Optional(t.String()),
                baseCurrency: t.Optional(t.String()),
            }),
        },
    )
    .patch(
        "/:id/currency",
        async ({ params, body, userId, set }) => {
            try {
                const groupId = parseInt(params.id);

                const group = await db.query.groups.findFirst({
                    where: eq(groups.id, groupId),
                });

                if (!group) {
                    set.status = 404;
                    return { error: "Group not found" };
                }

                if (group.createdBy !== userId) {
                    set.status = 403;
                    return { error: "Only group creator can change base currency" };
                }

                await db.update(groups).set({ baseCurrency: body.baseCurrency }).where(eq(groups.id, groupId));

                return { success: true };
            } catch (error) {
                console.error(error);
                set.status = 500;
                return { error: "Failed to update base currency" };
            }
        },
        {
            body: t.Object({
                baseCurrency: t.String(),
            }),
        },
    )
    .post(
        "/:id/members",
        async ({ params, body, userId, set }) => {
            try {
                const groupId = parseInt(params.id);

                const membership = await db.query.groupMembers.findFirst({
                    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
                });

                if (!membership) {
                    set.status = 403;
                    return { error: "Not a member of this group" };
                }

                const [member] = await db
                    .insert(groupMembers)
                    .values({
                        groupId: groupId,
                        userId: null,
                        name: body.name,
                        joinedAt: new Date(),
                    })
                    .returning();

                return member;
            } catch (error) {
                set.status = 500;
                return { error: "Failed to add guest member" };
            }
        },
        {
            body: t.Object({
                name: t.String({ minLength: 1 }),
            }),
        },
    )
    .get("/:id/members", async ({ params, userId, set }) => {
        const groupId = parseInt(params.id);

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            set.status = 403;
            return { error: "Not a member of this group" };
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

        return members;
    })
    .delete("/:groupId/members/:memberId", async ({ params, userId, set }) => {
        try {
            const groupId = parseInt(params.groupId);
            const memberId = parseInt(params.memberId);

            const membership = await db.query.groupMembers.findFirst({
                where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
            });

            if (!membership) {
                set.status = 403;
                return { error: "Not a member of this group" };
            }

            const memberToDelete = await db.query.groupMembers.findFirst({
                where: eq(groupMembers.id, memberId),
            });

            if (!memberToDelete || memberToDelete.groupId !== groupId) {
                set.status = 404;
                return { error: "Member not found" };
            }

            if (memberToDelete.userId !== null) {
                set.status = 400;
                return { error: "Cannot delete registered members" };
            }

            await db.delete(groupMembers).where(eq(groupMembers.id, memberId));

            return { success: true };
        } catch (error) {
            console.error(error);
            set.status = 500;
            return { error: "Failed to delete guest member" };
        }
    });
