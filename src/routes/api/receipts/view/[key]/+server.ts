import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { s3 } from "$lib/server/s3";

/**
 * Generates a presigned URL for viewing a receipt image
 * The URL is valid for 1 hour and redirects the user to S3
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const key = decodeURIComponent(params.key);

        // Validate the key format (basic security check)
        if (!key.startsWith("receipts/")) {
            throw error(400, "Invalid receipt key");
        }

        // Get S3 file reference
        const s3File = s3.file(key);

        // Check if file exists (optional, adds latency but improves UX)
        const exists = await s3File.exists();
        if (!exists) {
            throw error(404, "Receipt not found");
        }

        // Generate presigned URL (valid for 1 hour)
        const presignedUrl = s3File.presign({
            expiresIn: 60 * 60, // 1 hour
        });

        // Redirect to the presigned URL
        throw redirect(302, presignedUrl);
    } catch (err) {
        console.error("Error generating presigned URL:", err);

        // Re-throw SvelteKit errors
        if (err && typeof err === "object" && "status" in err) {
            throw err;
        }

        throw error(500, "Failed to load receipt image");
    }
};
