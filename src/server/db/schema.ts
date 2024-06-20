// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { group } from 'console'
import exp from 'constants'
import { desc, sql } from 'drizzle-orm'
import {
    index,
    integer,
    numeric,
    pgTableCreator,
    serial,
    timestamp,
    varchar,
} from 'drizzle-orm/pg-core'

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `owe-wari_${name}`)

export const users = createTable('users', {
    id: serial('id').primaryKey().notNull(),
    name: varchar('name', { length: 256 }).notNull(),
})

export const groups = createTable('groups', {
    id: serial('id').primaryKey().notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    description: varchar('description', { length: 256 }),
    currency: varchar('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(
        sql`CURRENT_TIMESTAMP`
    ),
})

export const groupMembers = createTable('group_members', {
    id: serial('id').primaryKey().notNull(),
    groupId: integer('group_id')
        .references(() => groups.id)
        .notNull(),
    userId: integer('user_id')
        .references(() => users.id)
        .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(
        sql`CURRENT_TIMESTAMP`
    ),
})

export const expenses = createTable('expenses', {
    id: serial('id').primaryKey().notNull(),
    groupId: integer('group_id')
        .references(() => groups.id)
        .notNull(),
    paidByUserId: integer('paid_by_user_id')
        .references(() => users.id)
        .notNull(),
    amount: numeric('amount').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(
        sql`CURRENT_TIMESTAMP`
    ),
})

export const expenseSplits = createTable('expense_splits', {
    id: serial('id').primaryKey().notNull(),
    expenseId: integer('expense_id')
        .references(() => expenses.id)
        .notNull(),
    userId: integer('user_id')
        .references(() => users.id)
        .notNull(),
    amount: numeric('amount').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(
        sql`CURRENT_TIMESTAMP`
    ),
})

export const indexes = [
    index('idx_group_id').on(groups.id),
    index('idx_user_id').on(users.id),
    index('idx_group_members_group_id').on(groupMembers.groupId),
    index('idx_group_members_user_id').on(groupMembers.userId),
    index('idx_expenses_group_id').on(expenses.groupId),
    index('idx_expenses_paid_by_user_id').on(expenses.paidByUserId),
    index('idx_expense_splits_expense_id').on(expenseSplits.expenseId),
    index('idx_expense_splits_user_id').on(expenseSplits.userId),
]
