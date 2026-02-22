import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { randomBytes } from "node:crypto";
import { db } from "$lib/server/db";
import { groups } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

const SHARE_CODE_LENGTH = 8;
const MAX_GENERATION_ATTEMPTS = 6;

function generateShareCode() {
    return randomBytes(6).toString("base64url").slice(0, SHARE_CODE_LENGTH);
}

async function ensureUniqueShareCode() {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
        const code = generateShareCode();
        const existing = await db.query.groups.findFirst({
            where: eq(groups.shareCode, code),
            columns: { id: true },
        });
        if (!existing) {
            return code;
        }
    }
    throw new Error("Failed to generate a unique share code");
}

async function getOwnedGroup(groupUuid: string, userId: number) {
    const group = await db.query.groups.findFirst({
        where: eq(groups.uuid, groupUuid),
        columns: {
            id: true,
            uuid: true,
            createdBy: true,
            shareCode: true,
            shareEnabled: true,
        },
    });

    if (!group) {
        return { error: json({ error: "Group not found" }, { status: 404 }) } as const;
    }

    if (group.createdBy !== userId) {
        return { error: json({ error: "Only group owner can manage share links" }, { status: 403 }) } as const;
    }

    return { group } as const;
}

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.id;

    const { group, error } = await getOwnedGroup(groupUuid, userId);
    if (error) return error;

    return json({
        enabled: group.shareEnabled,
        code: group.shareCode ?? null,
    });
};

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.id;

    const { group, error } = await getOwnedGroup(groupUuid, userId);
    if (error) return error;

    const body = await event.request.json().catch(() => ({}));
    const regenerate = Boolean(body?.regenerate);

    let nextCode = group.shareCode ?? null;
    if (!nextCode || regenerate || !group.shareEnabled) {
        nextCode = await ensureUniqueShareCode();
    }

    await db
        .update(groups)
        .set({
            shareCode: nextCode,
            shareEnabled: true,
        })
        .where(eq(groups.id, group.id));

    return json({
        enabled: true,
        code: nextCode,
    });
};

export const DELETE: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.id;

    const { group, error } = await getOwnedGroup(groupUuid, userId);
    if (error) return error;

    await db
        .update(groups)
        .set({ shareEnabled: false })
        .where(eq(groups.id, group.id));

    return json({
        enabled: false,
        code: group.shareCode ?? null,
    });
};
