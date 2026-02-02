import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { expenseShares, expenses, groupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, checkGroupArchived } from "$lib/server/utils";

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId;

    try {
        const body = await event.request.json();
        const {
            groupId,
            description,
            note,
            amount,
            currency,
            createdAt,
            paidBy,
            sharedWith,
            receiptImageUrl,
            receiptItems,
            attachments,
            customShares,
        } = body;

        // Validate required fields
        if (!groupId || !description || !amount || !sharedWith || sharedWith.length === 0) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Check if group is archived
        const isArchived = await checkGroupArchived(groupId);
        if (isArchived) {
            return json(
                { error: "Cannot add expenses to archived groups. Please unarchive the group first." },
                { status: 403 },
            );
        }

        // Validate custom date if provided
        if (createdAt) {
            const expenseDate = new Date(createdAt);
            const now = new Date();

            if (expenseDate > now) {
                return json({ error: "Expense date cannot be in the future" }, { status: 400 });
            }
        }

        // Determine who paid (defaults to current user's member record)
        let paidByMemberId = paidBy;
        if (!paidByMemberId) {
            paidByMemberId = membership.id;
        }

        const [expense] = await db
            .insert(expenses)
            .values({
                groupId,
                description,
                note: note || null,
                amount,
                currency: currency || "EUR",
                paidBy: paidByMemberId,
                receiptImageUrl: receiptImageUrl || null,
                receiptItems: receiptItems ? JSON.stringify(receiptItems) : null,
                attachments: attachments ? JSON.stringify(attachments) : null,
                createdAt: createdAt ? new Date(createdAt) : new Date(),
            })
            .returning();

        // Handle shares
        if (customShares && customShares.length > 0) {
            const totalCustom = customShares.reduce((sum: number, share: { amount: number }) => sum + share.amount, 0);
            if (Math.abs(totalCustom - amount) > 0.01) {
                return json({ error: "Custom shares must add up to the total amount" }, { status: 400 });
            }

            for (const share of customShares) {
                await db.insert(expenseShares).values({
                    expenseId: expense.id,
                    memberId: share.memberId,
                    share: share.amount,
                });
            }
        } else {
            const totalShares = sharedWith.length;
            const shareAmount = amount / totalShares;

            for (const memberId of sharedWith) {
                await db.insert(expenseShares).values({
                    expenseId: expense.id,
                    memberId: memberId,
                    share: shareAmount,
                });
            }
        }

        return json(expense);
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to create expense" }, { status: 500 });
    }
};
