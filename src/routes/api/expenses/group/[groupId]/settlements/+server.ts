import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, settlements } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupId = Number.parseInt(event.params.groupId);

    const membership = await db.query.groupMembers.findFirst({
        where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    });

    if (!membership) {
        return json({ error: "Not a member of this group" }, { status: 403 });
    }

    const groupSettlements = await db.query.settlements.findMany({
        where: eq(settlements.groupId, groupId),
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
