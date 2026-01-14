import { relations } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

export const groups = sqliteTable("groups", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    baseCurrency: text("base_currency").default("EUR"),
    createdBy: integer("created_by")
        .notNull()
        .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

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
    paidBy: integer("paid_by")
        .notNull()
        .references(() => groupMembers.id, { onDelete: "cascade" }),
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
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

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

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));
