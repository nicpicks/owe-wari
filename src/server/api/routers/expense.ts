import { z } from 'zod'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import { expenses } from '~/server/db/schema'

export const expenseRouter = createTRPCRouter({
    create: publicProcedure
        .input(
            z.object({
                groupId: z.number(),
                paidByUserId: z.number(),
                title: z.string().min(1),
                amount: z.number(),
                category: z.string().optional(),
                notes: z.string().optional(),
                expenseDate: z.date().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const newExpense = await ctx.db
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
                return { success: true, id: newExpense[0]?.id }
            } catch (error) {
                console.error('Error inserting expense:', error)
                throw new Error('Failed to create expense')
            }
        }),
})
