import { Elysia, t } from "elysia";
import { db } from "../db";
import { mockUsers, groupMembers } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const mockUserRoutes = new Elysia({ prefix: "/mock-users" })
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

        const [mockUser] = await db
          .insert(mockUsers)
          .values({
            groupId: body.groupId,
            name: body.name,
          })
          .returning();

        return mockUser;
      } catch (error) {
        set.status = 500;
        return { error: "Failed to create mock user" };
      }
    },
    {
      body: t.Object({
        groupId: t.Number(),
        name: t.String({ minLength: 1 }),
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

    const groupMockUsers = await db.query.mockUsers.findMany({
      where: eq(mockUsers.groupId, groupId),
      orderBy: (mockUsers, { asc }) => [asc(mockUsers.name)],
    });

    return groupMockUsers;
  })
  .delete("/:id", async ({ params, userId, set }) => {
    const mockUserId = parseInt(params.id);

    const mockUser = await db.query.mockUsers.findFirst({
      where: eq(mockUsers.id, mockUserId),
    });

    if (!mockUser) {
      set.status = 404;
      return { error: "Mock user not found" };
    }

    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, mockUser.groupId),
        eq(groupMembers.userId, userId)
      ),
    });

    if (!membership) {
      set.status = 403;
      return { error: "Not a member of this group" };
    }

    await db.delete(mockUsers).where(eq(mockUsers.id, mockUserId));

    return { success: true };
  });
