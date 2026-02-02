import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { getAttachmentKey, getMimeType, s3 } from "$lib/server/s3";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".csv", ".xlsx", ".xls", ".doc", ".docx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
        const body = await event.request.json();
        const { groupId, file, filename } = body;

        if (!groupId || !file || !filename) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check file extension
        const ext = filename.toLowerCase().split(".").pop();
        if (!ext || !ALLOWED_EXTENSIONS.includes(`.${ext}`)) {
            return json(
                {
                    error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`,
                },
                { status: 400 },
            );
        }

        // Check if user is a member of the group
        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Extract base64 data from data URL if needed
        let fileBase64 = file;
        if (fileBase64.includes(",")) {
            fileBase64 = fileBase64.split(",")[1];
        }

        // Check file size
        const fileBuffer = Buffer.from(fileBase64, "base64");
        if (fileBuffer.length > MAX_FILE_SIZE) {
            return json({ error: "File size exceeds 10MB limit" }, { status: 400 });
        }

        // Upload to S3
        const key = getAttachmentKey(groupId, filename);
        const s3File = s3.file(key);
        const mimeType = getMimeType(filename);

        await s3File.write(fileBuffer, {
            type: mimeType,
        });

        return json({
            url: key,
            name: filename,
            type: mimeType,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return json({ error: "Failed to upload attachment" }, { status: 500 });
    }
};
