import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { s3 } from "$lib/server/s3";

/**
 * Generates a presigned URL for viewing a receipt image or attachment
 * The URL is valid for 1 hour and redirects the user to S3
 */
export const GET: RequestHandler = async ({ params }) => {
    const key = decodeURIComponent(params.key);

    // Validate the key format (basic security check)
    if (
        !key.startsWith("receipts/") &&
        !key.startsWith("attachments/") &&
        !key.startsWith("avatars/") &&
        !key.startsWith("groups/")
    ) {
        throw error(400, "Invalid file key");
    }

    // Get S3 file reference
    const s3File = s3.file(key);

    // Check if file exists (optional, adds latency but improves UX)
    const exists = await s3File.exists();
    if (!exists) {
        throw error(404, "File not found");
    }

    let presignedUrl: string;
    try {
        // Generate presigned URL (valid for 1 hour)
        presignedUrl = s3File.presign({
            expiresIn: 60 * 60, // 1 hour
        });
    } catch (err) {
        console.error("Error generating presigned URL:", err);
        throw error(500, "Failed to load file");
    }

    // Redirect to the presigned URL
    throw redirect(302, presignedUrl);
};
