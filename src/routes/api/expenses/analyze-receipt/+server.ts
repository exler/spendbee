import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { analyzeReceipt } from "$lib/server/services/receipt";

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
        if (!process.env.MISTRAL_API_KEY) {
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

        // Save the image file
        const timestamp = Date.now();
        const filename = `receipt-${timestamp}.jpg`;
        const filepath = `static/uploads/${filename}`;

        const imageBuffer = Buffer.from(imageBase64, "base64");
        await Bun.write(filepath, imageBuffer);

        return json({
            ...receiptData,
            imageUrl: `/uploads/${filename}`,
        });
    } catch (error) {
        console.error("Receipt analysis error:", error);
        return json({ error: error instanceof Error ? error.message : "Failed to analyze receipt" }, { status: 500 });
    }
};
