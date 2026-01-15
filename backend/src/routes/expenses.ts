import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db";
import { expenseShares, expenses, groupMembers, groups, settlements } from "../db/schema";
import { convertCurrency, getExchangeRates } from "../services/currency";
import { analyzeReceipt } from "../services/receipt";
import type { Balance, CurrencyBalance } from "../types";

export const expenseRoutes = new Elysia({ prefix: "/expenses" })
    .derive(async ({ headers, set }) => {
        const authHeader = headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            throw new Error("Unauthorized");
        }

        const token = authHeader.substring(7);

        try {
            const jwt = await import("@elysiajs/jwt").then((m) =>
                m.jwt({
                    name: "jwt",
                    secret: process.env.JWT_SECRET || "spendbee-secret-key-change-in-production",
                }),
            );

            const payload = (await jwt.decorator.jwt.verify(token)) as { userId: number };

            if (!payload || !payload.userId) {
                set.status = 401;
                throw new Error("Invalid token");
            }

            return { userId: payload.userId };
        } catch {
            set.status = 401;
            throw new Error("Invalid token");
        }
    })
    .post(
        "/",
        async ({ body, userId, set }) => {
            try {
                const membership = await db.query.groupMembers.findFirst({
                    where: and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.userId, userId)),
                });

                if (!membership) {
                    set.status = 403;
                    return { error: "Not a member of this group" };
                }

                // Validate custom date if provided
                if (body.createdAt) {
                    const expenseDate = new Date(body.createdAt);
                    const now = new Date();

                    if (expenseDate > now) {
                        set.status = 400;
                        return { error: "Expense date cannot be in the future" };
                    }
                }

                // Determine who paid (defaults to current user)
                const paidBy = body.paidBy || userId;

                // Validate that the payer is a member of the group (if not current user)
                if (paidBy !== userId) {
                    const payerMembership = await db.query.groupMembers.findFirst({
                        where: and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.userId, paidBy)),
                    });

                    if (!payerMembership) {
                        set.status = 400;
                        return { error: "Selected payer is not a member of this group" };
                    }
                }

                const [expense] = await db
                    .insert(expenses)
                    .values({
                        groupId: body.groupId,
                        description: body.description,
                        note: body.note || null,
                        amount: body.amount,
                        currency: body.currency || "EUR",
                        paidBy: paidBy,
                        receiptImageUrl: body.receiptImageUrl || null,
                        receiptItems: body.receiptItems ? JSON.stringify(body.receiptItems) : null,
                        createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
                    })
                    .returning();

                if (body.customShares && body.customShares.length > 0) {
                    const totalCustom = body.customShares.reduce((sum, share) => sum + share.amount, 0);
                    if (Math.abs(totalCustom - body.amount) > 0.01) {
                        set.status = 400;
                        return { error: "Custom shares must add up to the total amount" };
                    }

                    for (const share of body.customShares) {
                        await db.insert(expenseShares).values({
                            expenseId: expense.id,
                            memberId: share.memberId,
                            share: share.amount,
                        });
                    }
                } else {
                    const totalShares = body.sharedWith.length;
                    const shareAmount = body.amount / totalShares;

                    for (const memberId of body.sharedWith) {
                        await db.insert(expenseShares).values({
                            expenseId: expense.id,
                            memberId: memberId,
                            share: shareAmount,
                        });
                    }
                }

                return expense;
            } catch (error) {
                console.error(error);
                set.status = 500;
                return { error: "Failed to create expense" };
            }
        },
        {
            body: t.Object({
                groupId: t.Number(),
                description: t.String({ minLength: 1 }),
                note: t.Optional(t.String()),
                amount: t.Number({ minimum: 0.01 }),
                currency: t.Optional(t.String()),
                createdAt: t.Optional(t.String()),
                paidBy: t.Optional(t.Number()),
                sharedWith: t.Array(t.Number()),
                receiptImageUrl: t.Optional(t.String()),
                receiptItems: t.Optional(
                    t.Array(
                        t.Object({
                            description: t.String(),
                            quantity: t.Number(),
                            price: t.Number(),
                            assignedTo: t.Optional(t.Array(t.Number())),
                        }),
                    ),
                ),
                customShares: t.Optional(
                    t.Array(
                        t.Object({
                            memberId: t.Number(),
                            amount: t.Number({ minimum: 0.01 }),
                        }),
                    ),
                ),
            }),
        },
    )
    .get("/group/:groupId", async ({ params, userId, set }) => {
        const groupId = Number.parseInt(params.groupId);

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            set.status = 403;
            return { error: "Not a member of this group" };
        }

        const groupExpenses = await db.query.expenses.findMany({
            where: eq(expenses.groupId, groupId),
            with: {
                payer: {
                    with: {
                        user: {
                            columns: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                shares: {
                    with: {
                        member: {
                            with: {
                                user: {
                                    columns: {
                                        id: true,
                                        name: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: (expenses, { desc }) => [desc(expenses.createdAt)],
        });

        return groupExpenses;
    })
    .get("/group/:groupId/balances", async ({ params, userId, set }) => {
        const groupId = Number.parseInt(params.groupId);

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            set.status = 403;
            return { error: "Not a member of this group" };
        }

        const group = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
        });

        if (!group) {
            set.status = 404;
            return { error: "Group not found" };
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

        return balances;
    })
    .post(
        "/settle",
        async ({ body, userId, set }) => {
            try {
                const membership = await db.query.groupMembers.findFirst({
                    where: and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.userId, userId)),
                });

                if (!membership) {
                    set.status = 403;
                    return { error: "Not a member of this group" };
                }

                const [settlement] = await db
                    .insert(settlements)
                    .values({
                        groupId: body.groupId,
                        fromMemberId: body.fromMemberId,
                        toMemberId: body.toMemberId,
                        amount: body.amount,
                        currency: body.currency || "EUR",
                    })
                    .returning();

                return settlement;
            } catch (error) {
                console.error(error);
                set.status = 500;
                return { error: "Failed to record settlement" };
            }
        },
        {
            body: t.Object({
                groupId: t.Number(),
                fromMemberId: t.Number(),
                toMemberId: t.Number(),
                amount: t.Number({ minimum: 0.01 }),
                currency: t.Optional(t.String()),
            }),
        },
    )
    .get("/group/:groupId/settlements", async ({ params, userId, set }) => {
        const groupId = Number.parseInt(params.groupId);

        const membership = await db.query.groupMembers.findFirst({
            where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        });

        if (!membership) {
            set.status = 403;
            return { error: "Not a member of this group" };
        }

        const groupSettlements = await db.query.settlements.findMany({
            where: eq(settlements.groupId, groupId),
            with: {
                fromMember: {
                    with: {
                        user: {
                            columns: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                toMember: {
                    with: {
                        user: {
                            columns: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: (settlements, { desc }) => [desc(settlements.createdAt)],
        });

        return groupSettlements;
    })
    .post(
        "/analyze-receipt",
        async ({ body, userId, set }) => {
            try {
                if (!process.env.MISTRAL_API_KEY) {
                    set.status = 500;
                    return { error: "Receipt scanning not configured. Please set MISTRAL_API_KEY." };
                }

                const membership = await db.query.groupMembers.findFirst({
                    where: and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.userId, userId)),
                });

                if (!membership) {
                    set.status = 403;
                    return { error: "Not a member of this group" };
                }

                // Extract base64 data from data URL if needed
                let imageBase64 = body.image;
                if (imageBase64.includes(",")) {
                    imageBase64 = imageBase64.split(",")[1];
                }

                const receiptData = await analyzeReceipt(imageBase64);

                // Save the image file
                const timestamp = Date.now();
                const filename = `receipt-${timestamp}.jpg`;
                const filepath = `uploads/${filename}`;

                const imageBuffer = Buffer.from(imageBase64, "base64");
                await Bun.write(filepath, imageBuffer);

                return {
                    ...receiptData,
                    imageUrl: `/uploads/${filename}`,
                };
            } catch (error) {
                console.error("Receipt analysis error:", error);
                set.status = 500;
                return { error: error instanceof Error ? error.message : "Failed to analyze receipt" };
            }
        },
        {
            body: t.Object({
                groupId: t.Number(),
                image: t.String(),
            }),
        },
    );
