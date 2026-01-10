import { Elysia, t } from "elysia";
import { db } from "../db";
import { groups, groupMembers, users } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const groupRoutes = new Elysia({ prefix: "/groups" })
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
        const [group] = await db
          .insert(groups)
          .values({
            name: body.name,
            description: body.description,
            createdBy: userId,
          })
          .returning();

        await db.insert(groupMembers).values({
          groupId: group.id,
          userId: userId,
        });

        return group;
      } catch (error) {
        set.status = 500;
        return { error: "Failed to create group" };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
      }),
    }
  )
  .get("/", async ({ userId }) => {
    const userGroups = await db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, userId),
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

    return userGroups.map((gm) => gm.group);
  })
  .get("/:id", async ({ params, userId, set }) => {
    const groupId = parseInt(params.id);

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

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
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
    });

    return group;
  })
  .post(
    "/:id/join",
    async ({ params, userId, set }) => {
      try {
        const groupId = parseInt(params.id);

        const group = await db.query.groups.findFirst({
          where: eq(groups.id, groupId),
        });

        if (!group) {
          set.status = 404;
          return { error: "Group not found" };
        }

        const existingMember = await db.query.groupMembers.findFirst({
          where: and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          ),
        });

        if (existingMember) {
          set.status = 400;
          return { error: "Already a member of this group" };
        }

        await db.insert(groupMembers).values({
          groupId: groupId,
          userId: userId,
        });

        return { success: true };
      } catch (error) {
        set.status = 500;
        return { error: "Failed to join group" };
      }
    }
  );
