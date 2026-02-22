import { beforeAll, beforeEach, afterAll, describe, expect, it, mock } from "bun:test";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createEvent, getDb, resetDb, setupTestDb, teardownTestDb } from "./helpers";
import * as schema from "../src/lib/server/db/schema";

let handlers: {
    registerPost: (event: any) => Promise<Response>;
    loginPost: (event: any) => Promise<Response>;
    groupsGet: (event: any) => Promise<Response>;
    groupsPost: (event: any) => Promise<Response>;
    balancesGet: (event: any) => Promise<Response>;
    invitePost: (event: any) => Promise<Response>;
};

beforeAll(async () => {
    const { dbPath } = setupTestDb();

    mock.module("$env/dynamic/private", () => ({
        env: {
            DATABASE_URL: dbPath,
            JWT_SECRET: "test-secret",
            PUBLIC_APP_URL: "http://localhost:5173",
        },
    }));

    mock.module("$env/dynamic/public", () => ({
        env: {
            PUBLIC_IS_INVITE_ONLY: "false",
        },
    }));

    const registerModule = await import("../src/routes/api/auth/register/+server");
    const loginModule = await import("../src/routes/api/auth/login/+server");
    const groupsModule = await import("../src/routes/api/groups/+server");
    const balancesModule = await import("../src/routes/api/expenses/group/[groupId]/balances/+server");
    const inviteModule = await import("../src/routes/api/groups/[id]/invite/+server");

    handlers = {
        registerPost: registerModule.POST,
        loginPost: loginModule.POST,
        groupsGet: groupsModule.GET,
        groupsPost: groupsModule.POST,
        balancesGet: balancesModule.GET,
        invitePost: inviteModule.POST,
    };
});

beforeEach(() => {
    resetDb();
});

afterAll(() => {
    teardownTestDb();
});

describe("Auth", () => {
    it("registers a user and sets a session cookie", async () => {
        const event = createEvent({
            body: { email: "user@example.com", password: "password123", name: "User" },
        });

        const response = await handlers.registerPost(event);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.user.email).toBe("user@example.com");
        expect(payload.groupUuid).toBeNull();
        expect(event.cookies.calls.length).toBe(1);
        expect((event.cookies.calls[0] as any[])[0]).toBe("token");
    });

    it("rejects registration with missing fields", async () => {
        const event = createEvent({ body: { email: "user@example.com" } });

        const response = await handlers.registerPost(event);
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.error).toBe("Missing required fields");
    });

    it("logs in an existing user", async () => {
        const db = getDb();
        const hashedPassword = await bcrypt.hash("password123", 10);

        const [user] = await db
            .insert(schema.users)
            .values({ email: "login@example.com", password: hashedPassword, name: "Login User" })
            .returning();

        const event = createEvent({
            body: { email: "login@example.com", password: "password123" },
        });

        const response = await handlers.loginPost(event);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.user.id).toBe(user.id);
        expect(event.cookies.calls.length).toBe(1);
        expect((event.cookies.calls[0] as any[])[0]).toBe("token");
    });

    it("rejects invalid login credentials", async () => {
        const db = getDb();
        const hashedPassword = await bcrypt.hash("password123", 10);

        await db
            .insert(schema.users)
            .values({ email: "login@example.com", password: hashedPassword, name: "Login User" })
            .returning();

        const event = createEvent({
            body: { email: "login@example.com", password: "wrongpass" },
        });

        const response = await handlers.loginPost(event);
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(payload.error).toBe("Invalid credentials");
    });
});

describe("Groups and loading data", () => {
    it("requires auth for group listing", async () => {
        const event = createEvent({ method: "GET", url: "http://localhost/api/groups" });

        const response = await handlers.groupsGet(event);
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(payload.error).toBe("Unauthorized");
    });

    it("creates a group and adds the creator as a member", async () => {
        const db = getDb();
        const [user] = await db
            .insert(schema.users)
            .values({ email: "owner@example.com", password: "hash", name: "Owner" })
            .returning();

        const event = createEvent({
            body: { name: "Trip" },
            userId: user.id,
        });

        const response = await handlers.groupsPost(event);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.name).toBe("Trip");

        const members = await db.query.groupMembers.findMany({
            where: (table, { eq }) => eq(table.userId, user.id),
        });

        expect(members.length).toBe(1);
        expect(members[0].groupId).toBe(payload.id);
    });

    it("loads groups with computed balances", async () => {
        const db = getDb();
        const [alice] = await db
            .insert(schema.users)
            .values({ email: "alice@example.com", password: "hash", name: "Alice" })
            .returning();
        const [bob] = await db
            .insert(schema.users)
            .values({ email: "bob@example.com", password: "hash", name: "Bob" })
            .returning();

        const [group] = await db
            .insert(schema.groups)
            .values({ name: "Trip", createdBy: alice.id, baseCurrency: "EUR", uuid: randomUUID() })
            .returning();

        const [aliceMember] = await db
            .insert(schema.groupMembers)
            .values({ groupId: group.id, userId: alice.id })
            .returning();
        const [bobMember] = await db
            .insert(schema.groupMembers)
            .values({ groupId: group.id, userId: bob.id })
            .returning();

        const [expense] = await db
            .insert(schema.expenses)
            .values({
                groupId: group.id,
                description: "Dinner",
                amount: 100,
                currency: "EUR",
                exchangeRate: 1,
                paidBy: aliceMember.id,
            })
            .returning();

        await db.insert(schema.expenseShares).values([
            { expenseId: expense.id, memberId: aliceMember.id, share: 50 },
            { expenseId: expense.id, memberId: bobMember.id, share: 50 },
        ]);

        await db.insert(schema.settlements).values({
            groupId: group.id,
            fromMemberId: bobMember.id,
            toMemberId: aliceMember.id,
            amount: 20,
            currency: "EUR",
            exchangeRate: 1,
        });

        const event = createEvent({
            method: "GET",
            userId: alice.id,
            url: "http://localhost/api/groups",
        });

        const response = await handlers.groupsGet(event);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.length).toBe(1);
        expect(payload[0].userBalance).toBe(30);
    });
});

describe("Balances", () => {
    it("calculates balances for a group", async () => {
        const db = getDb();
        const [alice] = await db
            .insert(schema.users)
            .values({ email: "alice@example.com", password: "hash", name: "Alice" })
            .returning();
        const [bob] = await db
            .insert(schema.users)
            .values({ email: "bob@example.com", password: "hash", name: "Bob" })
            .returning();

        const [group] = await db
            .insert(schema.groups)
            .values({ name: "Trip", createdBy: alice.id, baseCurrency: "EUR", uuid: randomUUID() })
            .returning();

        const [aliceMember] = await db
            .insert(schema.groupMembers)
            .values({ groupId: group.id, userId: alice.id })
            .returning();
        const [bobMember] = await db
            .insert(schema.groupMembers)
            .values({ groupId: group.id, userId: bob.id })
            .returning();

        const [expense] = await db
            .insert(schema.expenses)
            .values({
                groupId: group.id,
                description: "Dinner",
                amount: 100,
                currency: "EUR",
                exchangeRate: 1,
                paidBy: aliceMember.id,
            })
            .returning();

        await db.insert(schema.expenseShares).values([
            { expenseId: expense.id, memberId: aliceMember.id, share: 50 },
            { expenseId: expense.id, memberId: bobMember.id, share: 50 },
        ]);

        await db.insert(schema.settlements).values({
            groupId: group.id,
            fromMemberId: bobMember.id,
            toMemberId: aliceMember.id,
            amount: 20,
            currency: "EUR",
            exchangeRate: 1,
        });

        const event = createEvent({
            method: "GET",
            userId: alice.id,
            url: `http://localhost/api/expenses/group/${group.uuid}/balances`,
            params: { groupId: group.uuid },
        });

        const response = await handlers.balancesGet(event);
        const payload = await response.json();

        const aliceBalance = payload.find((b: any) => b.memberName === "Alice");
        const bobBalance = payload.find((b: any) => b.memberName === "Bob");

        expect(response.status).toBe(200);
        expect(payload.length).toBe(2);
        expect(aliceBalance.balance).toBe(30);
        expect(bobBalance.balance).toBe(-30);
    });
});

describe("Invites", () => {
    it("creates an in-app notification for existing users", async () => {
        const db = getDb();
        const [inviter] = await db
            .insert(schema.users)
            .values({ email: "inviter@example.com", password: "hash", name: "Inviter" })
            .returning();
        const [invitee] = await db
            .insert(schema.users)
            .values({ email: "invitee@example.com", password: "hash", name: "Invitee" })
            .returning();

        const [group] = await db
            .insert(schema.groups)
            .values({ name: "Trip", createdBy: inviter.id, baseCurrency: "EUR", uuid: randomUUID() })
            .returning();

        await db.insert(schema.groupMembers).values({ groupId: group.id, userId: inviter.id });

        const event = createEvent({
            body: { email: invitee.email },
            userId: inviter.id,
            params: { id: group.uuid },
            url: `http://localhost/api/groups/${group.uuid}/invite`,
        });

        const response = await handlers.invitePost(event);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.existingUser).toBe(true);

        const notifications = await db.query.notifications.findMany({
            where: (table, { eq }) => eq(table.userId, invitee.id),
        });

        expect(notifications.length).toBe(1);
        expect(notifications[0].type).toBe("group_invite");
    });

    it("creates a token for new user invitations", async () => {
        const db = getDb();
        const [inviter] = await db
            .insert(schema.users)
            .values({ email: "inviter@example.com", password: "hash", name: "Inviter" })
            .returning();

        const [group] = await db
            .insert(schema.groups)
            .values({ name: "Trip", createdBy: inviter.id, baseCurrency: "EUR", uuid: randomUUID() })
            .returning();

        await db.insert(schema.groupMembers).values({ groupId: group.id, userId: inviter.id });

        const event = createEvent({
            body: { email: "newuser@example.com" },
            userId: inviter.id,
            params: { id: group.uuid },
            url: `http://localhost/api/groups/${group.uuid}/invite`,
        });

        const response = await handlers.invitePost(event);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.existingUser).toBe(false);

        const tokens = await db.query.invitationTokens.findMany({
            where: (table, { eq }) => eq(table.email, "newuser@example.com"),
        });

        expect(tokens.length).toBe(1);
        expect(tokens[0].used).toBe(false);
    });
});
