import { S3Client } from "bun";
import { env } from "$env/dynamic/private";

/**
 * S3 client configured for Backblaze B2
 * Uses environment variables for credentials
 */
export const s3 = new S3Client({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT,
});

/**
 * Generate S3 key for receipt images
 * Format: receipts/{groupId}/receipt-{timestamp}.jpg
 *
 * @param groupId - The group ID this receipt belongs to
 * @param filename - The filename (e.g., "receipt-1768668372729.jpg")
 * @returns S3 key path
 */
export function getReceiptKey(groupId: number, filename: string): string {
    return `receipts/${groupId}/${filename}`;
}

/**
 * Generate S3 key for expense attachments
 * Format: attachments/{groupId}/{timestamp}-{filename}
 *
 * @param groupId - The group ID this attachment belongs to
 * @param filename - The original filename
 * @returns S3 key path
 */
export function getAttachmentKey(groupId: number, filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `attachments/${groupId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    const mimeTypes: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        pdf: "application/pdf",
        csv: "text/csv",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Delete a receipt image from S3
 * Safe to call even if the file doesn't exist
 *
 * @param key - The S3 key (receiptImageUrl from database)
 * @returns Promise that resolves when deletion is complete
 */
export async function deleteReceipt(key: string): Promise<void> {
    try {
        const s3File = s3.file(key);
        await s3File.delete();
    } catch (error) {
        // Log but don't throw - deletion failures shouldn't block other operations
        console.error("Failed to delete S3 file:", key, error);
    }
}
