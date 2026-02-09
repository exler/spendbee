import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groups } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { getMimeType, s3 } from "$lib/server/s3";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const MAX_FILE_SIZE = 8 * 1024 * 1024;

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.id;

    try {
        const group = await db.query.groups.findFirst({
            where: eq(groups.uuid, groupUuid),
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        if (group.createdBy !== userId) {
            return json({ error: "Only group creator can update group image" }, { status: 403 });
        }

        const body = await event.request.json();
        const { file, filename } = body;

        if (!file || !filename) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const ext = filename.toLowerCase().split(".").pop();
        if (!ext || !ALLOWED_EXTENSIONS.includes(`.${ext}`)) {
            return json(
                { error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}` },
                { status: 400 },
            );
        }

        let fileBase64 = file as string;
        if (fileBase64.includes(",")) {
            fileBase64 = fileBase64.split(",")[1];
        }

        const fileBuffer = Buffer.from(fileBase64, "base64");
        if (fileBuffer.length > MAX_FILE_SIZE) {
            return json({ error: "File size exceeds 8MB limit" }, { status: 400 });
        }

        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `groups/${group.id}/${Date.now()}-${sanitizedFilename}`;
        const s3File = s3.file(key);

        await s3File.write(fileBuffer, {
            type: getMimeType(filename),
        });

        const [updated] = await db.update(groups).set({ imageUrl: key }).where(eq(groups.id, group.id)).returning({
            id: groups.id,
            uuid: groups.uuid,
            name: groups.name,
            description: groups.description,
            baseCurrency: groups.baseCurrency,
            imageUrl: groups.imageUrl,
            archived: groups.archived,
            createdBy: groups.createdBy,
            createdAt: groups.createdAt,
        });

        return json(updated);
    } catch (error) {
        console.error("Group image upload error:", error);
        return json({ error: "Failed to upload group image" }, { status: 500 });
    }
};
