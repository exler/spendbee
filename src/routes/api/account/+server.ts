import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import bcrypt from "bcryptjs";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                createdAt: true,
            },
        });

        if (!user) {
            return json({ error: "User not found" }, { status: 404 });
        }

        return json({ user });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to load account" }, { status: 500 });
    }
};

export const PATCH: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
        const body = await event.request.json();
        const {
            name,
            avatarUrl,
            currentPassword,
            newPassword,
        }: {
            name?: string;
            avatarUrl?: string | null;
            currentPassword?: string;
            newPassword?: string;
        } = body;

        const updates: Record<string, string | null> = {};

        if (name !== undefined) {
            if (!name.trim()) {
                return json({ error: "Name is required" }, { status: 400 });
            }
            updates.name = name.trim();
        }

        if (avatarUrl !== undefined) {
            updates.avatarUrl = avatarUrl;
        }

        if (newPassword !== undefined) {
            if (!currentPassword) {
                return json({ error: "Current password is required" }, { status: 400 });
            }

            if (newPassword.length < 6) {
                return json({ error: "Password must be at least 6 characters" }, { status: 400 });
            }

            const user = await db.query.users.findFirst({
                where: eq(users.id, userId),
            });

            if (!user) {
                return json({ error: "User not found" }, { status: 404 });
            }

            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                return json({ error: "Current password is incorrect" }, { status: 400 });
            }

            updates.password = await bcrypt.hash(newPassword, 10);
        }

        if (Object.keys(updates).length === 0) {
            return json({ error: "No updates provided" }, { status: 400 });
        }

        const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning({
            id: users.id,
            email: users.email,
            name: users.name,
            avatarUrl: users.avatarUrl,
            createdAt: users.createdAt,
        });

        return json({ user: updated });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to update account" }, { status: 500 });
    }
};
