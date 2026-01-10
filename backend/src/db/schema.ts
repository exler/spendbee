import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const groupMembers = sqliteTable("group_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  paidBy: integer("paid_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const expenseShares = sqliteTable("expense_shares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  share: real("share").notNull(),
});

export const mockUsers = sqliteTable("mock_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const expenseSharesMock = sqliteTable("expense_shares_mock", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  mockUserId: integer("mock_user_id").notNull().references(() => mockUsers.id, { onDelete: "cascade" }),
  share: real("share").notNull(),
});

export const settlements = sqliteTable("settlements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  fromUserId: integer("from_user_id").references(() => users.id),
  toUserId: integer("to_user_id").references(() => users.id),
  fromMockUserId: integer("from_mock_user_id").references(() => mockUsers.id),
  toMockUserId: integer("to_mock_user_id").references(() => mockUsers.id),
  amount: real("amount").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  groupMembers: many(groupMembers),
  expenses: many(expenses),
  expenseShares: many(expenseShares),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
  members: many(groupMembers),
  expenses: many(expenses),
  settlements: many(settlements),
  mockUsers: many(mockUsers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  payer: one(users, {
    fields: [expenses.paidBy],
    references: [users.id],
  }),
  shares: many(expenseShares),
  mockShares: many(expenseSharesMock),
}));

export const mockUsersRelations = relations(mockUsers, ({ one, many }) => ({
  group: one(groups, {
    fields: [mockUsers.groupId],
    references: [groups.id],
  }),
  expenseShares: many(expenseSharesMock),
}));

export const expenseSharesMockRelations = relations(expenseSharesMock, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSharesMock.expenseId],
    references: [expenses.id],
  }),
  mockUser: one(mockUsers, {
    fields: [expenseSharesMock.mockUserId],
    references: [mockUsers.id],
  }),
}));

export const expenseSharesRelations = relations(expenseShares, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseShares.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expenseShares.userId],
    references: [users.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  group: one(groups, {
    fields: [settlements.groupId],
    references: [groups.id],
  }),
  fromUser: one(users, {
    fields: [settlements.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [settlements.toUserId],
    references: [users.id],
  }),
  fromMockUser: one(mockUsers, {
    fields: [settlements.fromMockUserId],
    references: [mockUsers.id],
  }),
  toMockUser: one(mockUsers, {
    fields: [settlements.toMockUserId],
    references: [mockUsers.id],
  }),
}));
