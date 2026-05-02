import { z } from 'zod'
import { eq, sql, and } from 'drizzle-orm'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import {
    expenses,
    expenseSplits,
    groupMembers,
    groupCurrencies,
    groups,
    settlements,
    users,
} from '~/server/db/schema'

export const expenseRouter = createTRPCRouter({
    create: publicProcedure
        .input(
            z.object({
                groupId: z.string(),
                paidByUserId: z.string(),
                title: z.string().min(1),
                amount: z.number(),
                currency: z.string().min(1),
                category: z.string().optional(),
                notes: z.string().optional(),
                expenseDate: z.date().optional(),
                splitUserIds: z.array(z.string()).optional(),
                splitAmounts: z.array(z.object({
                    userId: z.string(),
                    amount: z.number().positive(),
                })).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                await ctx.db.transaction(async (trx) => {
                    const allowed = await trx
                        .select({ code: groupCurrencies.code })
                        .from(groupCurrencies)
                        .where(
                            and(
                                eq(groupCurrencies.groupId, input.groupId),
                                eq(groupCurrencies.code, input.currency)
                            )
                        )
                        .execute()
                    if (allowed.length === 0) {
                        throw new Error(`Currency ${input.currency} is not enabled for this group`)
                    }

                    const [newExpense] = await trx
                        .insert(expenses)
                        .values({
                            groupId: input.groupId,
                            paidByUserId: input.paidByUserId,
                            title: input.title,
                            amount: input.amount.toString(),
                            currency: input.currency,
                            category: input.category,
                            notes: input.notes,
                            expenseDate: input.expenseDate,
                        })
                        .returning({ id: expenses.id })
                        .execute()
                    if (!newExpense?.id) {
                        throw new Error('Failed to create expense')
                    }
                    const expenseId = newExpense.id

                    let splitUserIds = input.splitUserIds
                    if (!splitUserIds || splitUserIds.length === 0) {
                        const members = await trx
                            .select({ userId: groupMembers.userId })
                            .from(groupMembers)
                            .where(eq(groupMembers.groupId, input.groupId))
                            .execute()
                        if (members.length === 0) {
                            throw new Error('no group members found')
                        }
                        splitUserIds = members.map((m) => m.userId)
                    }

                    if (input.splitAmounts && input.splitAmounts.length > 0) {
                        // Manual (or any future explicit-amount mode)
                        await trx
                            .insert(expenseSplits)
                            .values(
                                input.splitAmounts.map(({ userId, amount }) => ({
                                    expenseId,
                                    userId,
                                    amount: amount.toString(),
                                }))
                            )
                            .execute()
                    } else {
                        // Even split
                        const splitAmount = input.amount / splitUserIds.length
                        await trx
                            .insert(expenseSplits)
                            .values(
                                splitUserIds.map((userId) => ({
                                    expenseId,
                                    userId,
                                    amount: splitAmount.toString(),
                                }))
                            )
                            .execute()
                    }
                })

                return { success: true, id: input.groupId }
            } catch (error) {
                console.error('Error inserting expense:', error)
                throw new Error('Failed to create expense')
            }
        }),

    getExpenses: publicProcedure
        .input(z.object({ groupId: z.string() }))
        .query(async ({ ctx, input }) => {
            try {
                const expensesInGroup = await ctx.db
                    .select({
                        id: expenses.id,
                        title: expenses.title,
                        amount: expenses.amount,
                        currency: expenses.currency,
                        category: expenses.category,
                        notes: expenses.notes,
                        expenseDate: expenses.expenseDate,
                    })
                    .from(expenses)
                    .where(eq(expenses.groupId, input.groupId))
                    .execute()

                return expensesInGroup
            } catch (error) {
                console.error('Error getting expenses:', error)
                throw new Error('Failed to get expenses')
            }
        }),

    getExpense: publicProcedure
        .input(z.object({ expenseId: z.number() }))
        .query(async ({ ctx, input }) => {
            try {
                const [expense] = await ctx.db
                    .select({
                        id: expenses.id,
                        title: expenses.title,
                        amount: expenses.amount,
                        currency: expenses.currency,
                        category: expenses.category,
                        notes: expenses.notes,
                        expenseDate: expenses.expenseDate,
                        paidByUserId: expenses.paidByUserId,
                        paidByName: users.name,
                    })
                    .from(expenses)
                    .innerJoin(users, eq(users.id, expenses.paidByUserId))
                    .where(eq(expenses.id, input.expenseId))
                    .execute()

                if (!expense) throw new Error('Expense not found')

                const splits = await ctx.db
                    .select({
                        userId: expenseSplits.userId,
                        name: users.name,
                        amount: expenseSplits.amount,
                    })
                    .from(expenseSplits)
                    .innerJoin(users, eq(users.id, expenseSplits.userId))
                    .where(eq(expenseSplits.expenseId, input.expenseId))
                    .execute()

                return { ...expense, splits }
            } catch (error) {
                console.error('Error getting expense:', error)
                throw new Error('Failed to get expense')
            }
        }),

    getTotalExpenseCost: publicProcedure
        .input(z.object({ groupId: z.string() }))
        .query(async ({ ctx, input }) => {
            try {
                const [group] = await ctx.db
                    .select({ defaultCode: groups.currency })
                    .from(groups)
                    .where(eq(groups.id, input.groupId))
                    .execute()

                if (!group) {
                    return { defaultTotal: 0, defaultCurrency: 'SGD', otherCurrencyCount: 0 }
                }

                const [defaultRow] = await ctx.db
                    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
                    .from(expenses)
                    .where(
                        and(
                            eq(expenses.groupId, input.groupId),
                            eq(expenses.currency, group.defaultCode)
                        )
                    )
                    .execute()

                const [otherRow] = await ctx.db
                    .select({ count: sql<string>`COUNT(*)` })
                    .from(expenses)
                    .where(
                        and(
                            eq(expenses.groupId, input.groupId),
                            sql`${expenses.currency} <> ${group.defaultCode}`
                        )
                    )
                    .execute()

                return {
                    defaultTotal: parseFloat(defaultRow?.total ?? '0'),
                    defaultCurrency: group.defaultCode,
                    otherCurrencyCount: parseInt(otherRow?.count ?? '0', 10),
                }
            } catch (error) {
                console.error('Error getting total expense cost:', error)
                throw new Error('Failed to get total expense cost')
            }
        }),

    getBalances: publicProcedure
        .input(z.object({ groupId: z.string() }))
        .query(async ({ ctx, input }) => {
            try {
                const { groupId } = input

                const members = await ctx.db
                    .select({ userId: users.id, name: users.name })
                    .from(users)
                    .innerJoin(groupMembers, eq(users.id, groupMembers.userId))
                    .where(eq(groupMembers.groupId, groupId))
                    .execute()

                if (members.length === 0) return []

                const paidRows = await ctx.db
                    .select({
                        userId: expenses.paidByUserId,
                        currency: expenses.currency,
                        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
                    })
                    .from(expenses)
                    .where(eq(expenses.groupId, groupId))
                    .groupBy(expenses.paidByUserId, expenses.currency)
                    .execute()

                const owedRows = await ctx.db
                    .select({
                        userId: expenseSplits.userId,
                        currency: expenses.currency,
                        total: sql<string>`COALESCE(SUM(${expenseSplits.amount}), 0)`,
                    })
                    .from(expenseSplits)
                    .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
                    .where(eq(expenses.groupId, groupId))
                    .groupBy(expenseSplits.userId, expenses.currency)
                    .execute()

                const receivedRows = await ctx.db
                    .select({
                        userId: settlements.receiverId,
                        currency: settlements.currency,
                        total: sql<string>`COALESCE(SUM(${settlements.amount}), 0)`,
                    })
                    .from(settlements)
                    .where(eq(settlements.groupId, groupId))
                    .groupBy(settlements.receiverId, settlements.currency)
                    .execute()

                const settledRows = await ctx.db
                    .select({
                        userId: settlements.payerId,
                        currency: settlements.currency,
                        total: sql<string>`COALESCE(SUM(${settlements.amount}), 0)`,
                    })
                    .from(settlements)
                    .where(eq(settlements.groupId, groupId))
                    .groupBy(settlements.payerId, settlements.currency)
                    .execute()

                // (userId, currency) -> partial sums
                type Key = string
                const k = (userId: string, currency: string): Key => `${userId}|${currency}`
                const acc = new Map<Key, {
                    userId: string
                    currency: string
                    paid: number
                    owed: number
                    received: number
                    settled: number
                }>()
                const ensure = (userId: string, currency: string) => {
                    const key = k(userId, currency)
                    let row = acc.get(key)
                    if (!row) {
                        row = { userId, currency, paid: 0, owed: 0, received: 0, settled: 0 }
                        acc.set(key, row)
                    }
                    return row
                }

                for (const r of paidRows) ensure(r.userId, r.currency).paid = parseFloat(r.total)
                for (const r of owedRows) ensure(r.userId, r.currency).owed = parseFloat(r.total)
                for (const r of receivedRows) ensure(r.userId, r.currency).received = parseFloat(r.total)
                for (const r of settledRows) ensure(r.userId, r.currency).settled = parseFloat(r.total)

                const memberMap = new Map(members.map((m) => [m.userId, m.name]))

                const out: { userId: string; name: string; currency: string; netBalance: number }[] = []
                for (const row of acc.values()) {
                    const name = memberMap.get(row.userId)
                    if (!name) continue // user not in group anymore (defensive)
                    const netBalance = row.paid - row.owed - row.received + row.settled
                    if (Math.abs(netBalance) < 0.005) continue
                    out.push({ userId: row.userId, name, currency: row.currency, netBalance })
                }

                return out
            } catch (error) {
                console.error('Error getting balances:', error)
                throw new Error(error instanceof Error ? error.message : 'Failed to get balances')
            }
        }),

    settleUp: publicProcedure
        .input(
            z.object({
                groupId: z.string(),
                payerId: z.string(),
                receiverId: z.string(),
                lines: z
                    .array(
                        z.object({
                            currency: z.string().min(1),
                            amount: z.number().positive(),
                        })
                    )
                    .min(1),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                await ctx.db.transaction(async (trx) => {
                    const allowed = await trx
                        .select({ code: groupCurrencies.code })
                        .from(groupCurrencies)
                        .where(eq(groupCurrencies.groupId, input.groupId))
                        .execute()
                    const allowedSet = new Set(allowed.map((r) => r.code))
                    for (const line of input.lines) {
                        if (!allowedSet.has(line.currency)) {
                            throw new Error(`Currency ${line.currency} is not enabled for this group`)
                        }
                    }

                    await trx
                        .insert(settlements)
                        .values(
                            input.lines.map((line) => ({
                                groupId: input.groupId,
                                payerId: input.payerId,
                                receiverId: input.receiverId,
                                amount: line.amount.toString(),
                                currency: line.currency,
                            }))
                        )
                        .execute()
                })
                return { success: true }
            } catch (error) {
                console.error('Error settling up:', error)
                throw new Error('Failed to settle up')
            }
        }),
})
