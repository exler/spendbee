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
