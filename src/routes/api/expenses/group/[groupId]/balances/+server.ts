import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { expenseShares, expenses, groupMembers, groups, settlements } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";
import { convertCurrency, getExchangeRates } from "$lib/server/services/currency";
import type { Balance, CurrencyBalance } from "$lib/types";

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupId = Number.parseInt(event.params.groupId);

    const membership = await db.query.groupMembers.findFirst({
        where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    });

    if (!membership) {
        return json({ error: "Not a member of this group" }, { status: 403 });
    }

    const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
    });

    if (!group) {
        return json({ error: "Group not found" }, { status: 404 });
    }

    const baseCurrency = group.baseCurrency || "EUR";
    const rates = await getExchangeRates();

    const members = await db.query.groupMembers.findMany({
        where: eq(groupMembers.groupId, groupId),
        with: {
            user: {
                columns: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    const balances: Balance[] = [];

    for (const member of members) {
        const paidExpenses = await db
            .select({ amount: expenses.amount, currency: expenses.currency })
            .from(expenses)
            .where(and(eq(expenses.groupId, groupId), eq(expenses.paidBy, member.id)));

        const owedExpenses = await db
            .select({
                share: expenseShares.share,
                currency: expenses.currency,
            })
            .from(expenseShares)
            .innerJoin(expenses, eq(expenseShares.expenseId, expenses.id))
            .where(and(eq(expenses.groupId, groupId), eq(expenseShares.memberId, member.id)));

        const settlementsFrom = await db
            .select({ amount: settlements.amount, currency: settlements.currency })
            .from(settlements)
            .where(and(eq(settlements.groupId, groupId), eq(settlements.fromMemberId, member.id)));

        const settlementsTo = await db
            .select({ amount: settlements.amount, currency: settlements.currency })
            .from(settlements)
            .where(and(eq(settlements.groupId, groupId), eq(settlements.toMemberId, member.id)));

        const balanceByCurrency: { [key: string]: number } = {};

        for (const exp of paidExpenses) {
            const curr = exp.currency || "EUR";
            balanceByCurrency[curr] = (balanceByCurrency[curr] || 0) + exp.amount;
        }

        for (const exp of owedExpenses) {
            const curr = exp.currency || "EUR";
            balanceByCurrency[curr] = (balanceByCurrency[curr] || 0) - exp.share;
        }

        for (const settlement of settlementsTo) {
            const curr = settlement.currency || "EUR";
            balanceByCurrency[curr] = (balanceByCurrency[curr] || 0) + settlement.amount;
        }

        for (const settlement of settlementsFrom) {
            const curr = settlement.currency || "EUR";
            balanceByCurrency[curr] = (balanceByCurrency[curr] || 0) - settlement.amount;
        }

        const currencyBalances: CurrencyBalance[] = Object.entries(balanceByCurrency)
            .filter(([, amount]) => Math.abs(amount) >= 0.01)
            .map(([currency, amount]) => ({
                currency,
                amount: Math.round(amount * 100) / 100,
            }));

        let balanceInBaseCurrency = 0;
        for (const [currency, amount] of Object.entries(balanceByCurrency)) {
            balanceInBaseCurrency += convertCurrency(amount, currency, baseCurrency, rates);
        }

        balances.push({
            memberId: member.id,
            memberName: member.user?.name || member.name || "Unknown",
            balance: Math.round(balanceInBaseCurrency * 100) / 100,
            balanceByCurrency: currencyBalances,
            balanceInBaseCurrency: Math.round(balanceInBaseCurrency * 100) / 100,
            isGuest: member.userId === null,
        });
    }

    return json(balances);
};
