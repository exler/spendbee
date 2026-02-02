import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups, settlements } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.groupId;

    // First, find the group by UUID to get its ID
    const group = await db.query.groups.findFirst({
        where: eq(groups.uuid, groupUuid),
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

    const groupSettlements = await db.query.settlements.findMany({
        where: eq(settlements.groupId, group.id),
        with: {
            fromMember: {
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            toMember: {
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: (settlements, { desc }) => [desc(settlements.createdAt)],
    });

    return json(groupSettlements);
};
