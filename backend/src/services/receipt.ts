import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY || "",
});

export interface ReceiptItem {
    description: string;
    quantity: number;
    price: number;
}

export interface ReceiptData {
    businessName: string;
    items: ReceiptItem[];
    total: number;
    currency: string;
}

export async function analyzeReceipt(imageBase64: string): Promise<ReceiptData> {
    try {
        const ocrResponse = await mistral.ocr.process({
            model: "mistral-ocr-latest",
            document: {
                type: "image_url",
                imageUrl: `data:image/jpeg;base64,${imageBase64}`,
            },
            documentAnnotationFormat: {
                type: "json_schema",
                jsonSchema: {
                    name: "response_schema",
                    schemaDefinition: {
                        properties: {
                            businessName: {
                                type: "string",
                                description: "Name of the business",
                            },
                            currency: {
                                type: "string",
                                description: "Currency of the amounts on the receipt",
                            },
                            total: {
                                type: "number",
                                description: "Total amount",
                            },
                            items: {
                                type: "array",
                                description: "List of items with their descriptions, quantities, and prices",
                                minItems: 1,
                                items: {
                                    type: "object",
                                    properties: {
                                        description: {
                                            type: "string",
                                            description: "Item name",
                                        },
                                        quantity: {
                                            type: "number",
                                            description: "Item quantity",
                                        },
                                        price: {
                                            type: "number",
                                            description: "Item price",
                                        },
                                    },
                                    required: ["description", "quantity", "price"],
                                },
                            },
                        },
                        required: ["businessName", "total", "items"],
                    },
                },
            },
            includeImageBase64: true,
        });

        if (!ocrResponse.documentAnnotation) {
            throw new Error("No JSON found in response");
        }
        const receiptData = JSON.parse(ocrResponse.documentAnnotation).properties as ReceiptData;

        return receiptData as ReceiptData;
    } catch (error) {
        console.error("Receipt analysis error:", error);
        throw new Error("Failed to analyze receipt. Please try again or enter details manually.");
    }
}
