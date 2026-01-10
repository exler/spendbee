import { Elysia, t } from "elysia";
import { db } from "../db";
import { expenses, expenseShares, expenseSharesMock, groupMembers, settlements, mockUsers } from "../db/schema";
import { eq, and, sql, or } from "drizzle-orm";
import type { Balance } from "../types";

export const expenseRoutes = new Elysia({ prefix: "/expenses" })
  .derive(async ({ headers, set }) => {
    const authHeader = headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      throw new Error("Unauthorized");
    }

    const token = authHeader.substring(7);
    
    try {
      const jwt = await import("@elysiajs/jwt").then(m => m.jwt({
        name: "jwt",
        secret: process.env.JWT_SECRET || "spendbee-secret-key-change-in-production",
      }));
      
      const payload = await jwt.decorator.jwt.verify(token) as { userId: number };
      
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
          where: and(
            eq(groupMembers.groupId, body.groupId),
            eq(groupMembers.userId, userId)
          ),
        });

        if (!membership) {
          set.status = 403;
          return { error: "Not a member of this group" };
        }

        const [expense] = await db
          .insert(expenses)
          .values({
            groupId: body.groupId,
            description: body.description,
            amount: body.amount,
            paidBy: userId,
          })
          .returning();

        const totalShares = body.sharedWith.length + body.sharedWithMock.length;
        const shareAmount = body.amount / totalShares;

        for (const memberId of body.sharedWith) {
          await db.insert(expenseShares).values({
            expenseId: expense.id,
            userId: memberId,
            share: shareAmount,
          });
        }

        for (const mockUserId of body.sharedWithMock) {
          await db.insert(expenseSharesMock).values({
            expenseId: expense.id,
            mockUserId: mockUserId,
            share: shareAmount,
          });
        }

        return expense;
      } catch (error) {
        set.status = 500;
        return { error: "Failed to create expense" };
      }
    },
    {
      body: t.Object({
        groupId: t.Number(),
        description: t.String({ minLength: 1 }),
        amount: t.Number({ minimum: 0.01 }),
        sharedWith: t.Array(t.Number()),
        sharedWithMock: t.Array(t.Number()),
      }),
    }
  )
  .get("/group/:groupId", async ({ params, userId, set }) => {
    const groupId = parseInt(params.groupId);

    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ),
    });

    if (!membership) {
      set.status = 403;
      return { error: "Not a member of this group" };
    }

    const groupExpenses = await db.query.expenses.findMany({
      where: eq(expenses.groupId, groupId),
      with: {
        payer: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        shares: {
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
        mockShares: {
          with: {
            mockUser: {
              columns: {
                id: true,
                name: true,
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
    const groupId = parseInt(params.groupId);

    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ),
    });

    if (!membership) {
      set.status = 403;
      return { error: "Not a member of this group" };
    }

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

    const groupMockUsers = await db.query.mockUsers.findMany({
      where: eq(mockUsers.groupId, groupId),
    });

    const balances: Balance[] = [];

    for (const member of members) {
      const paid = await db
        .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
        .from(expenses)
        .where(
          and(
            eq(expenses.groupId, groupId),
            eq(expenses.paidBy, member.userId)
          )
        );

      const owed = await db
        .select({ total: sql<number>`COALESCE(SUM(${expenseShares.share}), 0)` })
        .from(expenseShares)
        .innerJoin(expenses, eq(expenseShares.expenseId, expenses.id))
        .where(
          and(
            eq(expenses.groupId, groupId),
            eq(expenseShares.userId, member.userId)
          )
        );

      const settledFrom = await db
        .select({ total: sql<number>`COALESCE(SUM(${settlements.amount}), 0)` })
        .from(settlements)
        .where(
          and(
            eq(settlements.groupId, groupId),
            eq(settlements.fromUserId, member.userId),
            sql`${settlements.fromUserId} IS NOT NULL`
          )
        );

      const settledTo = await db
        .select({ total: sql<number>`COALESCE(SUM(${settlements.amount}), 0)` })
        .from(settlements)
        .where(
          and(
            eq(settlements.groupId, groupId),
            eq(settlements.toUserId, member.userId),
            sql`${settlements.toUserId} IS NOT NULL`
          )
        );

      const balance =
        (paid[0]?.total || 0) -
        (owed[0]?.total || 0) +
        (settledTo[0]?.total || 0) -
        (settledFrom[0]?.total || 0);

      balances.push({
        userId: member.userId,
        userName: member.user.name,
        balance: Math.round(balance * 100) / 100,
        isMock: false,
      });
    }

    for (const mockUser of groupMockUsers) {
      const owed = await db
        .select({ total: sql<number>`COALESCE(SUM(${expenseSharesMock.share}), 0)` })
        .from(expenseSharesMock)
        .innerJoin(expenses, eq(expenseSharesMock.expenseId, expenses.id))
        .where(
          and(
            eq(expenses.groupId, groupId),
            eq(expenseSharesMock.mockUserId, mockUser.id)
          )
        );

      const settledFrom = await db
        .select({ total: sql<number>`COALESCE(SUM(${settlements.amount}), 0)` })
        .from(settlements)
        .where(
          and(
            eq(settlements.groupId, groupId),
            eq(settlements.fromMockUserId, mockUser.id),
            sql`${settlements.fromMockUserId} IS NOT NULL`
          )
        );

      const settledTo = await db
        .select({ total: sql<number>`COALESCE(SUM(${settlements.amount}), 0)` })
        .from(settlements)
        .where(
          and(
            eq(settlements.groupId, groupId),
            eq(settlements.toMockUserId, mockUser.id),
            sql`${settlements.toMockUserId} IS NOT NULL`
          )
        );

      const balance =
        0 -
        (owed[0]?.total || 0) +
        (settledTo[0]?.total || 0) -
        (settledFrom[0]?.total || 0);

      balances.push({
        userId: mockUser.id,
        userName: mockUser.name,
        balance: Math.round(balance * 100) / 100,
        isMock: true,
      });
    }

    return balances;
  })
  .post(
    "/settle",
    async ({ body, userId, set }) => {
      try {
        const membership = await db.query.groupMembers.findFirst({
          where: and(
            eq(groupMembers.groupId, body.groupId),
            eq(groupMembers.userId, userId)
          ),
        });

        if (!membership) {
          set.status = 403;
          return { error: "Not a member of this group" };
        }

        const [settlement] = await db
          .insert(settlements)
          .values({
            groupId: body.groupId,
            fromUserId: body.fromUserId || null,
            toUserId: body.toUserId || null,
            fromMockUserId: body.fromMockUserId || null,
            toMockUserId: body.toMockUserId || null,
            amount: body.amount,
          })
          .returning();

        return settlement;
      } catch (error) {
        set.status = 500;
        return { error: "Failed to record settlement" };
      }
    },
    {
      body: t.Object({
        groupId: t.Number(),
        fromUserId: t.Optional(t.Number()),
        toUserId: t.Optional(t.Number()),
        fromMockUserId: t.Optional(t.Number()),
        toMockUserId: t.Optional(t.Number()),
        amount: t.Number({ minimum: 0.01 }),
      }),
    }
  )
  .get("/group/:groupId/settlements", async ({ params, userId, set }) => {
    const groupId = parseInt(params.groupId);

    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ),
    });

    if (!membership) {
      set.status = 403;
      return { error: "Not a member of this group" };
    }

    const groupSettlements = await db.query.settlements.findMany({
      where: eq(settlements.groupId, groupId),
      with: {
        fromUser: {
          columns: {
            id: true,
            name: true,
          },
        },
        toUser: {
          columns: {
            id: true,
            name: true,
          },
        },
        fromMockUser: {
          columns: {
            id: true,
            name: true,
          },
        },
        toMockUser: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: (settlements, { desc }) => [desc(settlements.createdAt)],
    });

    return groupSettlements;
  });
