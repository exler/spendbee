import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db";
import { groupMembers, notifications } from "../db/schema";

export const notificationRoutes = new Elysia({ prefix: "/notifications" })
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
    .get("/", async ({ userId }) => {
        const userNotifications = await db.query.notifications.findMany({
            where: eq(notifications.userId, userId),
            orderBy: [desc(notifications.createdAt)],
        });

        return userNotifications;
    })
    .get("/unread-count", async ({ userId }) => {
        const unreadNotifications = await db.query.notifications.findMany({
            where: and(eq(notifications.userId, userId), eq(notifications.read, false)),
        });

        return { count: unreadNotifications.length };
    })
    .patch("/:id/read", async ({ params, userId, set }) => {
        const notificationId = Number.parseInt(params.id);

        const notification = await db.query.notifications.findFirst({
            where: eq(notifications.id, notificationId),
        });

        if (!notification || notification.userId !== userId) {
            set.status = 404;
            return { error: "Notification not found" };
        }

        await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));

        return { success: true };
    })
    .post("/:id/accept", async ({ params, userId, set }) => {
        try {
            const notificationId = Number.parseInt(params.id);

            const notification = await db.query.notifications.findFirst({
                where: eq(notifications.id, notificationId),
            });

            if (!notification || notification.userId !== userId) {
                set.status = 404;
                return { error: "Notification not found" };
            }

            if (notification.type !== "group_invite") {
                set.status = 400;
                return { error: "Invalid notification type" };
            }

            const data = JSON.parse(notification.data || "{}");
            const groupId = data.groupId;

            // Check if already a member
            const existingMember = await db.query.groupMembers.findFirst({
                where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
            });

            if (existingMember) {
                // Delete notification and return success
                await db.delete(notifications).where(eq(notifications.id, notificationId));
                return { success: true };
            }

            // Add user to group
            await db.insert(groupMembers).values({
                groupId: groupId,
                userId: userId,
            });

            // Delete notification
            await db.delete(notifications).where(eq(notifications.id, notificationId));

            return { success: true, groupId };
        } catch (error) {
            console.error(error);
            set.status = 500;
            return { error: "Failed to accept invitation" };
        }
    })
    .post("/:id/decline", async ({ params, userId, set }) => {
        try {
            const notificationId = Number.parseInt(params.id);

            const notification = await db.query.notifications.findFirst({
                where: eq(notifications.id, notificationId),
            });

            if (!notification || notification.userId !== userId) {
                set.status = 404;
                return { error: "Notification not found" };
            }

            // Delete notification
            await db.delete(notifications).where(eq(notifications.id, notificationId));

            return { success: true };
        } catch (error) {
            console.error(error);
            set.status = 500;
            return { error: "Failed to decline invitation" };
        }
    });
