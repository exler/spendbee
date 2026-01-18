import { Mistral } from "@mistralai/mistralai";
import { responseFormatFromZodObject } from "@mistralai/mistralai/extra/structChat";
import { z } from "zod";

const mistral = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY || "",
});

const receiptItemSchema = z.object({
    description: z.string().describe("Item name"),
    quantity: z.number().describe("Item quantity"),
    price: z.number().describe("Item price"),
});

const receiptDataSchema = z.object({
    businessName: z.string().describe("Name of the business"),
    items: z.array(receiptItemSchema).min(1).describe("List of items with their descriptions, quantities, and prices"),
    total: z.number().describe("Total amount"),
    currency: z.string().describe("Currency of the amounts on the receipt"),
});

export type ReceiptItem = z.infer<typeof receiptItemSchema>;
export type ReceiptData = z.infer<typeof receiptDataSchema>;

export async function analyzeReceipt(imageBase64: string): Promise<ReceiptData> {
    try {
        const ocrResponse = await mistral.ocr.process({
            model: "mistral-ocr-latest",
            document: {
                type: "image_url",
                imageUrl: `data:image/jpeg;base64,${imageBase64}`,
            },
            documentAnnotationFormat: responseFormatFromZodObject(receiptDataSchema),
            includeImageBase64: true,
        });

        if (!ocrResponse.documentAnnotation) {
            throw new Error("No JSON found in response");
        }
        const receiptData = JSON.parse(ocrResponse.documentAnnotation) as ReceiptData;
        console.log(ocrResponse);

        return receiptData as ReceiptData;
    } catch (error) {
        console.error("Receipt analysis error:", error);
        throw new Error("Failed to analyze receipt. Please try again or enter details manually.");
    }
}
