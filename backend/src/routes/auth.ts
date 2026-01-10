import { Elysia, t } from "elysia";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { jwt } from "@elysiajs/jwt";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "spendbee-secret-key-change-in-production",
    })
  )
  .post(
    "/register",
    async ({ body, set, jwt }) => {
      try {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, body.email),
        });

        if (existingUser) {
          set.status = 400;
          return { error: "Email already registered" };
        }

        const hashedPassword = await bcrypt.hash(body.password, 10);

        const [user] = await db
          .insert(users)
          .values({
            email: body.email,
            password: hashedPassword,
            name: body.name,
          })
          .returning();

        const token = await jwt.sign({
          userId: user.id,
          email: user.email,
        });

        return {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
          },
        };
      } catch (error) {
        set.status = 500;
        return { error: "Failed to register user" };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
        name: t.String({ minLength: 1 }),
      }),
    }
  )
  .post(
    "/login",
    async ({ body, set, jwt }) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, body.email),
        });

        if (!user) {
          set.status = 401;
          return { error: "Invalid credentials" };
        }

        const validPassword = await bcrypt.compare(body.password, user.password);

        if (!validPassword) {
          set.status = 401;
          return { error: "Invalid credentials" };
        }

        const token = await jwt.sign({
          userId: user.id,
          email: user.email,
        });

        return {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
          },
        };
      } catch (error) {
        set.status = 500;
        return { error: "Failed to login" };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    }
  );
