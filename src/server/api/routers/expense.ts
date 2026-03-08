import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import {
    expenses,
    expenseSplits,
    groupMembers,
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
                    const [newExpense] = await trx
                        .insert(expenses)
                        .values({
                            groupId: input.groupId,
                            paidByUserId: input.paidByUserId,
                            title: input.title,
                            amount: input.amount.toString(),
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
                const totalExpenseCost = await ctx.db
                    .select({ total: sql<number>`SUM(${expenses.amount})` })
                    .from(expenses)
                    .where(eq(expenses.groupId, input.groupId))
                    .execute()

                return totalExpenseCost[0]?.total ?? 0
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

                // Get all members in the group
                const members = await ctx.db
                    .select({ userId: users.id, name: users.name })
                    .from(users)
                    .innerJoin(groupMembers, eq(users.id, groupMembers.userId))
                    .where(eq(groupMembers.groupId, groupId))
                    .execute()

                if (members.length === 0) return []

                // SUM paid by each user
                const paidRows = await ctx.db
                    .select({
                        userId: expenses.paidByUserId,
                        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
                    })
                    .from(expenses)
                    .where(eq(expenses.groupId, groupId))
                    .groupBy(expenses.paidByUserId)
                    .execute()

                // SUM owed by each user (via expense_splits)
                const owedRows = await ctx.db
                    .select({
                        userId: expenseSplits.userId,
                        total: sql<string>`COALESCE(SUM(${expenseSplits.amount}), 0)`,
                    })
                    .from(expenseSplits)
                    .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
                    .where(eq(expenses.groupId, groupId))
                    .groupBy(expenseSplits.userId)
                    .execute()

                // SUM received in settlements (receiverId)
                const receivedRows = await ctx.db
                    .select({
                        userId: settlements.receiverId,
                        total: sql<string>`COALESCE(SUM(${settlements.amount}), 0)`,
                    })
                    .from(settlements)
                    .where(eq(settlements.groupId, groupId))
                    .groupBy(settlements.receiverId)
                    .execute()

                // SUM paid in settlements (payerId)
                const settledRows = await ctx.db
                    .select({
                        userId: settlements.payerId,
                        total: sql<string>`COALESCE(SUM(${settlements.amount}), 0)`,
                    })
                    .from(settlements)
                    .where(eq(settlements.groupId, groupId))
                    .groupBy(settlements.payerId)
                    .execute()

                const paidMap = new Map(paidRows.map((r) => [r.userId, parseFloat(r.total)]))
                const owedMap = new Map(owedRows.map((r) => [r.userId, parseFloat(r.total)]))
                const receivedMap = new Map(receivedRows.map((r) => [r.userId, parseFloat(r.total)]))
                const settledMap = new Map(settledRows.map((r) => [r.userId, parseFloat(r.total)]))

                return members.map(({ userId, name }) => {
                    const paid = paidMap.get(userId) ?? 0
                    const owed = owedMap.get(userId) ?? 0
                    const received = receivedMap.get(userId) ?? 0
                    const settled = settledMap.get(userId) ?? 0
                    const netBalance = paid - owed - received + settled
                    return { userId, name, netBalance }
                })
            } catch (error) {
                console.error('Error getting balances:', error)
                throw new Error('Failed to get balances')
            }
        }),

    settleUp: publicProcedure
        .input(
            z.object({
                groupId: z.string(),
                payerId: z.string(),
                receiverId: z.string(),
                amount: z.number(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                await ctx.db
                    .insert(settlements)
                    .values({
                        groupId: input.groupId,
                        payerId: input.payerId,
                        receiverId: input.receiverId,
                        amount: input.amount.toString(),
                    })
                    .execute()

                return { success: true }
            } catch (error) {
                console.error('Error settling up:', error)
                throw new Error('Failed to settle up')
            }
        }),
})
