import { redirect, error as kitError } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";

export const load: PageServerLoad = async (event) => {
    const shareCode = event.params.code;

    const group = await db.query.groups.findFirst({
        where: and(eq(groups.shareCode, shareCode), eq(groups.shareEnabled, true)),
        columns: {
            id: true,
            uuid: true,
            name: true,
            description: true,
        },
    });

    if (!group) {
        throw kitError(404, "This share link is invalid or has been disabled.");
    }

    const userId = event.locals.userId;
    if (userId) {
        const existingMember = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
            columns: { id: true },
        });

        if (!existingMember) {
            await db.insert(groupMembers).values({
                groupId: group.id,
                userId,
                joinedAt: new Date(),
            });
        }

        throw redirect(302, `/groups/${group.uuid}`);
    }

    return {
        shareCode,
        group: {
            name: group.name,
            description: group.description,
        },
    };
};
