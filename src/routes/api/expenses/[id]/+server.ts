import { json, type RequestEvent } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { expenseShares, expenses, groupMembers } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, checkGroupArchived } from "$lib/server/utils";

export const DELETE = async (event: RequestEvent) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const expenseId = Number.parseInt(event.params.id!);

    try {
        // Get the expense
        const expense = await db.query.expenses.findFirst({
            where: eq(expenses.id, expenseId),
        });

        if (!expense) {
            return json({ error: "Expense not found" }, { status: 404 });
        }

        // Check if user is a member of the group
        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, expense.groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Check if group is archived
        const isArchived = await checkGroupArchived(expense.groupId);
        if (isArchived) {
            return json(
                { error: "Cannot delete expenses from archived groups. Please unarchive the group first." },
                { status: 403 },
            );
        }

        // Delete the expense (shares will be cascade deleted)
        await db.delete(expenses).where(eq(expenses.id, expenseId));

        return json({ success: true });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to delete expense" }, { status: 500 });
    }
};

export const PATCH = async (event: RequestEvent) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const expenseId = Number.parseInt(event.params.id!);

    try {
        const body = await event.request.json();
        const {
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

        // Get the expense
        const expense = await db.query.expenses.findFirst({
            where: eq(expenses.id, expenseId),
        });

        if (!expense) {
            return json({ error: "Expense not found" }, { status: 404 });
        }

        // Check if user is a member of the group
        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, expense.groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            return json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Check if group is archived
        const isArchived = await checkGroupArchived(expense.groupId);
        if (isArchived) {
            return json(
                { error: "Cannot update expenses in archived groups. Please unarchive the group first." },
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

        // Build update object with only provided fields
        const updateData: any = {};
        if (description !== undefined) updateData.description = description;
        if (note !== undefined) updateData.note = note || null;
        if (amount !== undefined) updateData.amount = amount;
        if (currency !== undefined) updateData.currency = currency;
        if (paidBy !== undefined) updateData.paidBy = paidBy;
        if (receiptImageUrl !== undefined) updateData.receiptImageUrl = receiptImageUrl || null;
        if (receiptItems !== undefined) updateData.receiptItems = receiptItems ? JSON.stringify(receiptItems) : null;
        if (attachments !== undefined) updateData.attachments = attachments ? JSON.stringify(attachments) : null;
        if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);

        // Update the expense
        const [updatedExpense] = await db
            .update(expenses)
            .set(updateData)
            .where(eq(expenses.id, expenseId))
            .returning();

        // Update shares if provided
        if (sharedWith !== undefined && sharedWith.length > 0) {
            // Delete old shares
            await db.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));

            // Add new shares
            if (customShares && customShares.length > 0) {
                const totalCustom = customShares.reduce(
                    (sum: number, share: { amount: number }) => sum + share.amount,
                    0,
                );
                const finalAmount = amount !== undefined ? amount : expense.amount;

                if (Math.abs(totalCustom - finalAmount) > 0.01) {
                    return json({ error: "Custom shares must add up to the total amount" }, { status: 400 });
                }

                for (const share of customShares) {
                    await db.insert(expenseShares).values({
                        expenseId: expenseId,
                        memberId: share.memberId,
                        share: share.amount,
                    });
                }
            } else {
                const totalShares = sharedWith.length;
                const finalAmount = amount !== undefined ? amount : expense.amount;
                const shareAmount = finalAmount / totalShares;

                for (const memberId of sharedWith) {
                    await db.insert(expenseShares).values({
                        expenseId: expenseId,
                        memberId: memberId,
                        share: shareAmount,
                    });
                }
            }
        }

        return json(updatedExpense);
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to update expense" }, { status: 500 });
    }
};
