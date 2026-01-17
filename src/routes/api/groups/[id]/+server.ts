import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups } from "$lib/server/db/schema";
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

    return json(group);
};

export const PATCH: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupId = Number.parseInt(event.params.id);

    try {
        const group = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        if (group.createdBy !== userId) {
            return json({ error: "Only group creator can update group settings" }, { status: 403 });
        }

        const body = await event.request.json();
        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.baseCurrency !== undefined) updates.baseCurrency = body.baseCurrency;

        await db.update(groups).set(updates).where(eq(groups.id, groupId));

        return json({ success: true });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to update group" }, { status: 500 });
    }
};
