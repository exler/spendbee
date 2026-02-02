import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { analyzeReceipt } from "$lib/server/services/receipt";
import { getReceiptKey, getAttachmentKey, getMimeType, s3 } from "$lib/server/s3";
import { env } from "$env/dynamic/private";
import * as Sentry from "@sentry/sveltekit";

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    let groupId: number | undefined;

    try {
        if (!env.MISTRAL_API_KEY) {
            return json({ error: "Receipt scanning not configured. Please set MISTRAL_API_KEY." }, { status: 500 });
        }

        const body = await event.request.json();
        const { groupId: gId, image, additionalFiles } = body;
        groupId = gId;

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

        // Upload additional files if provided
        const uploadedAttachments = [];
        if (additionalFiles && Array.isArray(additionalFiles)) {
            for (const file of additionalFiles.slice(0, 4)) {
                // Limit to 4 additional files
                try {
                    let fileBase64 = file.data;
                    if (fileBase64.includes(",")) {
                        fileBase64 = fileBase64.split(",")[1];
                    }

                    const fileBuffer = Buffer.from(fileBase64, "base64");
                    const attachmentKey = getAttachmentKey(groupId, file.name);
                    const attachmentS3File = s3.file(attachmentKey);
                    const mimeType = getMimeType(file.name);

                    await attachmentS3File.write(fileBuffer, {
                        type: mimeType,
                    });

                    uploadedAttachments.push({
                        url: attachmentKey,
                        name: file.name,
                        type: mimeType,
                    });
                } catch (error) {
                    console.error("Failed to upload additional file:", file.name, error);
                }
            }
        }

        return json({
            ...receiptData,
            imageUrl: key, // Store S3 key instead of URL path
            attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        });
    } catch (error) {
        console.error("Receipt analysis error:");
        if (error instanceof Error) {
            console.error(`Name: ${error.name}`);
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        } else {
            console.error("Error object:", JSON.stringify(error, null, 2));
        }

        // Capture receipt analysis errors in Sentry
        Sentry.captureException(error, {
            tags: {
                endpoint: "analyze-receipt",
                userId: userId.toString(),
            },
            extra: {
                groupId,
            },
        });

        return json({ error: error instanceof Error ? error.message : "Failed to analyze receipt" }, { status: 500 });
    }
};
