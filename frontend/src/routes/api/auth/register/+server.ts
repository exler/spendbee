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
		const { email, password, name } = body;

		// Validation
		if (!email || !password || !name) {
			return json({ error: "Missing required fields" }, { status: 400 });
		}

		if (password.length < 6) {
			return json({ error: "Password must be at least 6 characters" }, { status: 400 });
		}

		// Check if user already exists
		const existingUser = await db.query.users.findFirst({
			where: eq(users.email, email),
		});

		if (existingUser) {
			return json({ error: "Email already registered" }, { status: 400 });
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create user
		const [user] = await db
			.insert(users)
			.values({
				email,
				password: hashedPassword,
				name,
			})
			.returning();

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
			token,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				createdAt: user.createdAt,
			},
		});
	} catch (error) {
		console.error(error);
		return json({ error: "Failed to register user" }, { status: 500 });
	}
};
