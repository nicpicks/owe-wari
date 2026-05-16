// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from 'drizzle-orm'
import {
    index,
    integer,
    numeric,
    pgTableCreator,
    serial,
    text,
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
    id: varchar('id', { length: 26 }).primaryKey().notNull(),
    name: varchar('name', { length: 256 }).notNull(),
})

export const groups = createTable('groups', {
    id: varchar('id', { length: 26 }).primaryKey().notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    description: varchar('description', { length: 256 }),
    currency: varchar('currency', { length: 3 }).notNull(),
    defaultPayee: varchar('default_payee', { length: 26 }).references(
        () => users.id
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(
        sql`CURRENT_TIMESTAMP`
    ),
})

export const groupMembers = createTable(
    'group_members',
    {
        id: serial('id').primaryKey().notNull(),
        groupId: varchar('group_id', { length: 26 })
            .references(() => groups.id)
            .notNull(),
        userId: varchar('user_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).default(
            sql`CURRENT_TIMESTAMP`
        ),
    },
    (t) => ({
        groupIdIdx: index('idx_group_members_group_id').on(t.groupId),
        userIdIdx: index('idx_group_members_user_id').on(t.userId),
    })
)

export const groupCurrencies = createTable(
    'group_currencies',
    {
        id: serial('id').primaryKey().notNull(),
        groupId: varchar('group_id', { length: 26 })
            .references(() => groups.id)
            .notNull(),
        code: varchar('code', { length: 3 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).default(
            sql`CURRENT_TIMESTAMP`
        ),
    },
    (t) => ({
        groupIdIdx: index('idx_group_currencies_group_id').on(t.groupId),
    })
)

export const expenses = createTable(
    'expenses',
    {
        id: serial('id').primaryKey().notNull(),
        groupId: varchar('group_id', { length: 26 })
            .references(() => groups.id)
            .notNull(),
        paidByUserId: varchar('paid_by_user_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        createdByUserId: varchar('created_by_user_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        title: varchar('title', { length: 256 }).notNull(),
        amount: numeric('amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull().default('SGD'),
        category: varchar('category', { length: 256 }),
        notes: varchar('notes', { length: 256 }),
        expenseDate: timestamp('expense_date', { withTimezone: true })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).default(
            sql`CURRENT_TIMESTAMP`
        ),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
    },
    (t) => ({
        groupIdIdx: index('idx_expenses_group_id').on(t.groupId),
        paidByUserIdIdx: index('idx_expenses_paid_by_user_id').on(t.paidByUserId),
        groupDateIdx: index('idx_expenses_group_date').on(t.groupId, t.deletedAt, t.expenseDate, t.id),
    })
)

export const expenseSplits = createTable(
    'expense_splits',
    {
        id: serial('id').primaryKey().notNull(),
        expenseId: integer('expense_id')
            .references(() => expenses.id)
            .notNull(),
        userId: varchar('user_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        amount: numeric('amount').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).default(
            sql`CURRENT_TIMESTAMP`
        ),
    },
    (t) => ({
        expenseIdIdx: index('idx_expense_splits_expense_id').on(t.expenseId),
        userIdIdx: index('idx_expense_splits_user_id').on(t.userId),
    })
)

export const settlements = createTable(
    'settlements',
    {
        id: serial('id').primaryKey().notNull(),
        groupId: varchar('group_id', { length: 26 })
            .references(() => groups.id)
            .notNull(),
        payerId: varchar('payer_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        receiverId: varchar('receiver_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        amount: numeric('amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull().default('SGD'),
        settledAt: timestamp('settled_at', { withTimezone: true })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (t) => ({
        groupIdIdx: index('idx_settlements_group_id').on(t.groupId),
        payerIdIdx: index('idx_settlements_payer_id').on(t.payerId),
        receiverIdIdx: index('idx_settlements_receiver_id').on(t.receiverId),
    })
)

export const expenseAudits = createTable(
    'expense_audits',
    {
        id: serial('id').primaryKey().notNull(),
        expenseId: integer('expense_id')
            .references(() => expenses.id)
            .notNull(),
        groupId: varchar('group_id', { length: 26 })
            .references(() => groups.id)
            .notNull(),
        actorId: varchar('actor_id', { length: 26 })
            .references(() => users.id)
            .notNull(),
        fieldsChanged: text('fields_changed').array().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (t) => ({
        groupIdIdx: index('idx_expense_audits_group_id').on(t.groupId),
        expenseIdIdx: index('idx_expense_audits_expense_id').on(t.expenseId),
    })
)
