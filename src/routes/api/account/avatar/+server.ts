import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { getMimeType, s3 } from "$lib/server/s3";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
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
            return json({ error: "File size exceeds 5MB limit" }, { status: 400 });
        }

        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `avatars/${userId}/${Date.now()}-${sanitizedFilename}`;
        const s3File = s3.file(key);

        await s3File.write(fileBuffer, {
            type: getMimeType(filename),
        });

        const [updated] = await db.update(users).set({ avatarUrl: key }).where(eq(users.id, userId)).returning({
            id: users.id,
            email: users.email,
            name: users.name,
            avatarUrl: users.avatarUrl,
            createdAt: users.createdAt,
        });

        return json({ user: updated });
    } catch (error) {
        console.error("Avatar upload error:", error);
        return json({ error: "Failed to upload avatar" }, { status: 500 });
    }
};
