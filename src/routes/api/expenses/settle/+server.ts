import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { groupMembers, settlements, groups } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, checkGroupArchived } from "$lib/server/utils";
import { getExchangeRate, getExchangeRates } from "$lib/server/services/currency";

export const POST: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;

    try {
        const body = await event.request.json();
        const { groupId, fromMemberId, toMemberId, amount, currency } = body;

        if (!groupId || !fromMemberId || !toMemberId || !amount) {
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
                { error: "Cannot settle debts in archived groups. Please unarchive the group first." },
                { status: 403 },
            );
        }

        // Get group to determine base currency
        const group = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
        });

        if (!group) {
            return json({ error: "Group not found" }, { status: 404 });
        }

        const baseCurrency = group.baseCurrency || "EUR";
        const settlementCurrency = currency || "EUR";

        // Fetch current exchange rates and calculate the rate to store
        const rates = await getExchangeRates();
        const exchangeRate = getExchangeRate(settlementCurrency, baseCurrency, rates);

        const [settlement] = await db
            .insert(settlements)
            .values({
                groupId,
                fromMemberId,
                toMemberId,
                amount,
                currency: settlementCurrency,
                exchangeRate,
            })
            .returning();

        return json(settlement);
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to record settlement" }, { status: 500 });
    }
};
