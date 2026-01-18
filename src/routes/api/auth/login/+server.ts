import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import bcrypt from "bcryptjs";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { signJWT } from "$lib/server/auth";

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { email, password } = body;

        // Validation
        if (!email || !password) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        // Find user
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!user) {
            return json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Generate JWT
        const token = await signJWT({
            userId: user.id,
            email: user.email,
        });

        // Set HTTP-only cookie
        cookies.set("token", token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        return json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to login" }, { status: 500 });
    }
};
