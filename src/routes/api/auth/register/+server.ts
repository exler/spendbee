import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import bcrypt from "bcryptjs";
import { db } from "$lib/server/db";
import { users, groupMembers, invitationTokens } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { signJWT } from "$lib/server/auth";

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { email, password, name, token } = body;

        // Validation
        if (!email || !password || !name) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        if (password.length < 6) {
            return json({ error: "Password must be at least 6 characters" }, { status: 400 });
        }

        // Check if invitation token is required (no token = require invitation)
        if (!token) {
            return json(
                { error: "Registration requires an invitation. Please ask a group member to invite you." },
                { status: 403 },
            );
        }

        // Validate invitation token
        const invitation = await db.query.invitationTokens.findFirst({
            where: and(eq(invitationTokens.token, token), eq(invitationTokens.used, false)),
            with: {
                group: true,
            },
        });

        if (!invitation) {
            return json({ error: "Invalid or expired invitation token" }, { status: 400 });
        }

        // Check if token has expired
        if (invitation.expiresAt < new Date()) {
            return json({ error: "This invitation has expired. Please request a new one." }, { status: 400 });
        }

        // Check if email matches invitation
        if (invitation.email.toLowerCase() !== email.toLowerCase()) {
            return json({ error: "Email does not match the invitation" }, { status: 400 });
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

        // Add user to the group automatically
        await db.insert(groupMembers).values({
            groupId: invitation.groupId,
            userId: user.id,
        });

        // Mark invitation token as used
        await db.update(invitationTokens).set({ used: true }).where(eq(invitationTokens.id, invitation.id));

        // Generate JWT
        const jwtToken = await signJWT({
            userId: user.id,
            email: user.email,
        });

        // Set HTTP-only cookie
        cookies.set("token", jwtToken, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: true,
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        return json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
            },
            groupUuid: invitation.group.uuid,
        });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to register user" }, { status: 500 });
    }
};
