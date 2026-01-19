import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { analyzeReceipt } from "$lib/server/services/receipt";
import { getReceiptKey, s3 } from "$lib/server/s3";
import { env } from "$env/dynamic/private";

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
        if (!env.MISTRAL_API_KEY) {
            return json({ error: "Receipt scanning not configured. Please set MISTRAL_API_KEY." }, { status: 500 });
        }

        const body = await event.request.json();
        const { groupId, image } = body;

        if (!groupId || !image) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Extract base64 data from data URL if needed
        let imageBase64 = image;
        if (imageBase64.includes(",")) {
            imageBase64 = imageBase64.split(",")[1];
        }

        const receiptData = await analyzeReceipt(imageBase64);
        console.log(receiptData);

        // Upload the image to S3
        const timestamp = Date.now();
        const filename = `receipt-${timestamp}.jpg`;
        const key = getReceiptKey(groupId, filename);

        const imageBuffer = Buffer.from(imageBase64, "base64");
        const s3File = s3.file(key);
        await s3File.write(imageBuffer, {
            type: "image/jpeg",
        });

        return json({
            ...receiptData,
            imageUrl: key, // Store S3 key instead of URL path
        });
    } catch (error) {
        console.error("Receipt analysis error:", error);
        return json({ error: error instanceof Error ? error.message : "Failed to analyze receipt" }, { status: 500 });
    }
};
