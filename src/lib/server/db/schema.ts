import { relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { randomUUID } from "node:crypto";

export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

export const groups = sqliteTable(
    "groups",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        uuid: text("uuid")
            .notNull()
            .unique()
            .$defaultFn(() => randomUUID()),
        name: text("name").notNull(),
        description: text("description"),
        baseCurrency: text("base_currency").default("EUR"),
        archived: integer("archived", { mode: "boolean" }).notNull().default(false),
        createdBy: integer("created_by")
            .notNull()
            .references(() => users.id),
        createdAt: integer("created_at", { mode: "timestamp" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => ({
        uuidIdx: index("groups_uuid_idx").on(table.uuid),
    }),
);

export const groupMembers = sqliteTable("group_members", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
        .notNull()
        .references(() => groups.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    joinedAt: integer("joined_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

export const expenses = sqliteTable("expenses", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
        .notNull()
        .references(() => groups.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    note: text("note"),
    amount: real("amount").notNull(),
    currency: text("currency").default("EUR").notNull(),
    exchangeRate: real("exchange_rate").notNull().default(1), // Rate from expense currency to group base currency at creation time
    paidBy: integer("paid_by")
        .notNull()
        .references(() => groupMembers.id, { onDelete: "cascade" }),
    receiptImageUrl: text("receipt_image_url"), // Deprecated - kept for backward compatibility
    receiptItems: text("receipt_items"), // JSON string of receipt items
    attachments: text("attachments"), // JSON string of attachment objects [{url: string, type: string, name: string}]
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

export const expenseShares = sqliteTable("expense_shares", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    expenseId: integer("expense_id")
        .notNull()
        .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
        .notNull()
        .references(() => groupMembers.id, { onDelete: "cascade" }),
    share: real("share").notNull(),
});

export const settlements = sqliteTable("settlements", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
        .notNull()
        .references(() => groups.id, { onDelete: "cascade" }),
    fromMemberId: integer("from_member_id")
        .notNull()
        .references(() => groupMembers.id, { onDelete: "cascade" }),
    toMemberId: integer("to_member_id")
        .notNull()
        .references(() => groupMembers.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    currency: text("currency").default("EUR").notNull(),
    exchangeRate: real("exchange_rate").notNull().default(1), // Rate from settlement currency to group base currency at creation time
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

export const activities = sqliteTable(
    "activities",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        groupId: integer("group_id")
            .notNull()
            .references(() => groups.id, { onDelete: "cascade" }),
        actorMemberId: integer("actor_member_id")
            .notNull()
            .references(() => groupMembers.id, { onDelete: "cascade" }),
        type: text("type").notNull(),
        expenseId: integer("expense_id").references(() => expenses.id, { onDelete: "set null" }),
        settlementId: integer("settlement_id").references(() => settlements.id, { onDelete: "set null" }),
        fromMemberId: integer("from_member_id").references(() => groupMembers.id, { onDelete: "set null" }),
        toMemberId: integer("to_member_id").references(() => groupMembers.id, { onDelete: "set null" }),
        amount: real("amount"),
        currency: text("currency"),
        metadata: text("metadata"),
        createdAt: integer("created_at", { mode: "timestamp" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => ({
        groupIdx: index("activities_group_idx").on(table.groupId),
        actorIdx: index("activities_actor_idx").on(table.actorMemberId),
        createdIdx: index("activities_created_idx").on(table.createdAt),
    }),
);

export const notifications = sqliteTable("notifications", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'group_invite'
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: text("data"), // JSON string with additional data
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

export const invitationTokens = sqliteTable(
    "invitation_tokens",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        token: text("token")
            .notNull()
            .unique()
            .$defaultFn(() => randomUUID()),
        email: text("email").notNull(),
        groupId: integer("group_id")
            .notNull()
            .references(() => groups.id, { onDelete: "cascade" }),
        invitedBy: integer("invited_by")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        used: integer("used", { mode: "boolean" }).notNull().default(false),
        expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
        createdAt: integer("created_at", { mode: "timestamp" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => ({
        tokenIdx: index("invitation_tokens_token_idx").on(table.token),
        emailIdx: index("invitation_tokens_email_idx").on(table.email),
    }),
);

export const usersRelations = relations(users, ({ many }) => ({
    groupMembers: many(groupMembers),
    notifications: many(notifications),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
    creator: one(users, {
        fields: [groups.createdBy],
        references: [users.id],
    }),
    members: many(groupMembers),
    expenses: many(expenses),
    settlements: many(settlements),
    activities: many(activities),
}));

export const groupMembersRelations = relations(groupMembers, ({ one, many }) => ({
    group: one(groups, {
        fields: [groupMembers.groupId],
        references: [groups.id],
    }),
    user: one(users, {
        fields: [groupMembers.userId],
        references: [users.id],
    }),
    expenseShares: many(expenseShares),
    activitiesAsActor: many(activities, {
        relationName: "activity_actor",
    }),
    activitiesAsFrom: many(activities, {
        relationName: "activity_from",
    }),
    activitiesAsTo: many(activities, {
        relationName: "activity_to",
    }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
    group: one(groups, {
        fields: [expenses.groupId],
        references: [groups.id],
    }),
    payer: one(groupMembers, {
        fields: [expenses.paidBy],
        references: [groupMembers.id],
    }),
    shares: many(expenseShares),
}));

export const expenseSharesRelations = relations(expenseShares, ({ one }) => ({
    expense: one(expenses, {
        fields: [expenseShares.expenseId],
        references: [expenses.id],
    }),
    member: one(groupMembers, {
        fields: [expenseShares.memberId],
        references: [groupMembers.id],
    }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
    group: one(groups, {
        fields: [settlements.groupId],
        references: [groups.id],
    }),
    fromMember: one(groupMembers, {
        fields: [settlements.fromMemberId],
        references: [groupMembers.id],
    }),
    toMember: one(groupMembers, {
        fields: [settlements.toMemberId],
        references: [groupMembers.id],
    }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
    group: one(groups, {
        fields: [activities.groupId],
        references: [groups.id],
    }),
    actorMember: one(groupMembers, {
        fields: [activities.actorMemberId],
        references: [groupMembers.id],
        relationName: "activity_actor",
    }),
    fromMember: one(groupMembers, {
        fields: [activities.fromMemberId],
        references: [groupMembers.id],
        relationName: "activity_from",
    }),
    toMember: one(groupMembers, {
        fields: [activities.toMemberId],
        references: [groupMembers.id],
        relationName: "activity_to",
    }),
    expense: one(expenses, {
        fields: [activities.expenseId],
        references: [expenses.id],
    }),
    settlement: one(settlements, {
        fields: [activities.settlementId],
        references: [settlements.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));

export const invitationTokensRelations = relations(invitationTokens, ({ one }) => ({
    group: one(groups, {
        fields: [invitationTokens.groupId],
        references: [groups.id],
    }),
    inviter: one(users, {
        fields: [invitationTokens.invitedBy],
        references: [users.id],
    }),
}));
