import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import { expenses, expenseSplits, groupMembers } from '~/server/db/schema'

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
                            // check this why i need toString here
                            amount: input.amount.toString(),
                            category: input.category,
                            notes: input.notes,
                            expenseDate: input.expenseDate,
                        })
                        .returning({ id: expenses.id })
                        .execute()
                    if (!newExpense || !newExpense.id) {
                        throw new Error('Failed to create expense')
                    }
                    const expenseId = newExpense.id
                    const members = await trx
                        .select({ userId: groupMembers.userId })
                        .from(groupMembers)
                        .where(eq(groupMembers.groupId, input.groupId))
                        .execute()
                    if (members.length === 0) {
                        throw new Error('no group members found')
                    }

                    // Assuming equal splitting
                    const splitAmount = input.amount / members.length
                    await trx
                        .insert(expenseSplits)
                        .values(
                            members.map((member) => ({
                                expenseId,
                                userId: member.userId,
                                amount: splitAmount.toString(),
                            }))
                        )
                        .execute()
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
})
