import { z } from 'zod'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import { groups } from '~/server/db/schema'

export const groupRouter = createTRPCRouter({
    create: publicProcedure
        .input(
            z.object({
                name: z.string().min(1),
                currency: z.string().min(1),
                description: z.string(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                await ctx.db.insert(groups).values({
                    name: input.name,
                    currency: input.currency,
                    description: input.description,
                })

                return { success: true }
            } catch (error) {
                console.error('Error inserting group:', error)
                throw new Error('Failed to create group')
            }
        }),

    getLatest: publicProcedure.query(async ({ ctx }) => {
        try {
            return await ctx.db.query.groups.findFirst({
                orderBy: (groups, { desc }) => [desc(groups.createdAt)],
            })
        } catch (error) {
            console.error('Error fetching latest group:', error)
            throw new Error('Failed to fetch latest group')
        }
    }),
})
