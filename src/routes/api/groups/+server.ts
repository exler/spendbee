import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, groups, expenses, expenseShares, settlements } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId;
    const includeArchived = event.url.searchParams.get("includeArchived") === "true";

    const userGroups = await db.query.groupMembers.findMany({
        where: eq(groupMembers.userId, userId!),
        with: {
            group: {
                with: {
                    creator: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            },
        },
    });

    // Filter out archived groups unless explicitly requested
    const filteredGroups = includeArchived ? userGroups : userGroups.filter((gm) => !gm.group.archived);

    // Calculate user balance for each group
    const groupsWithBalance = await Promise.all(
        filteredGroups.map(async (gm) => {
            const group = gm.group;
            const baseCurrency = group.baseCurrency || "EUR";

            // Get the user's member ID in this group
            const memberId = gm.id;

            // Calculate balance in each currency
            const balanceByCurrency: { [key: string]: number } = {};

            // Amount paid by user
            const paidExpenses = await db
                .select({
                    amount: expenses.amount,
                    currency: expenses.currency,
                    exchangeRate: expenses.exchangeRate,
                })
                .from(expenses)
                .where(and(eq(expenses.groupId, group.id), eq(expenses.paidBy, memberId)));

            for (const exp of paidExpenses) {
                const curr = exp.currency || "EUR";
                balanceByCurrency[curr] = (balanceByCurrency[curr] || 0) + exp.amount;
            }

            // Amount owed by user
            const owedExpenses = await db
                .select({
                    share: expenseShares.share,
                    currency: expenses.currency,
                    exchangeRate: expenses.exchangeRate,
                })
                .from(expenseShares)
                .innerJoin(expenses, eq(expenseShares.expenseId, expenses.id))
                .where(and(eq(expenses.groupId, group.id), eq(expenseShares.memberId, memberId)));

            for (const exp of owedExpenses) {
                const curr = exp.currency || "EUR";
                balanceByCurrency[curr] = (balanceByCurrency[curr] || 0) - exp.share;
            }

            // Settlements to user
            const settlementsTo = await db
                .select({
                    amount: settlements.amount,
                    currency: settlements.currency,
                    exchangeRate: settlements.exchangeRate,
                })
                .from(settlements)
                .where(and(eq(settlements.groupId, group.id), eq(settlements.toMemberId, memberId)));

            for (const settlement of settlementsTo) {
                const curr = settlement.currency || "EUR";
                balanceByCurrency[curr] = (balanceByCurrency[curr] || 0) - settlement.amount;
            }

            // Settlements from user
            const settlementsFrom = await db
                .select({
                    amount: settlements.amount,
                    currency: settlements.currency,
                    exchangeRate: settlements.exchangeRate,
                })
                .from(settlements)
                .where(and(eq(settlements.groupId, group.id), eq(settlements.fromMemberId, memberId)));

            for (const settlement of settlementsFrom) {
                const curr = settlement.currency || "EUR";
                balanceByCurrency[curr] = (balanceByCurrency[curr] || 0) + settlement.amount;
            }

            // Convert to base currency using stored exchange rates
            let userBalance = 0;

            // Add amounts paid
            for (const exp of paidExpenses) {
                const amountInBase = exp.amount * (exp.exchangeRate || 1);
                userBalance += amountInBase;
            }

            // Subtract amounts owed
            for (const exp of owedExpenses) {
                const shareInBase = exp.share * (exp.exchangeRate || 1);
                userBalance -= shareInBase;
            }

            // Add settlements from user
            for (const settlement of settlementsFrom) {
                const amountInBase = settlement.amount * (settlement.exchangeRate || 1);
                userBalance += amountInBase;
            }

            // Subtract settlements to user
            for (const settlement of settlementsTo) {
                const amountInBase = settlement.amount * (settlement.exchangeRate || 1);
                userBalance -= amountInBase;
            }

            return {
                ...group,
                userBalance: Math.round(userBalance * 100) / 100,
            };
        }),
    );

    return json(groupsWithBalance);
};

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
        const body = await event.request.json();
        const { name, description, baseCurrency } = body;

        if (!name || name.length < 1) {
            return json({ error: "Name is required" }, { status: 400 });
        }

        const [group] = await db
            .insert(groups)
            .values({
                name,
                description: description || null,
                baseCurrency: baseCurrency || "EUR",
                createdBy: userId,
            })
            .returning();

        await db.insert(groupMembers).values({
            groupId: group.id,
            userId: userId,
        });

        return json(group);
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to create group" }, { status: 500 });
    }
};
