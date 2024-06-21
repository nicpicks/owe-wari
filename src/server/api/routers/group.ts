import { z } from 'zod'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import { groups, users, groupMembers } from '~/server/db/schema'
import { ulid } from 'ulid'

export const groupRouter = createTRPCRouter({
    create: publicProcedure
        .input(
            z.object({
                name: z.string().min(1),
                currency: z.string().min(1),
                description: z.string(),
                userNames: z.array(z.string().min(1)),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const groupId = ulid()
                const newGroup = await ctx.db
                    .insert(groups)
                    .values({
                        id: groupId,
                        name: input.name,
                        currency: input.currency,
                        description: input.description,
                    })
                    .returning({ id: groups.id })

                for (const userName of input.userNames) {
                    const userId = ulid()

                    await ctx.db.insert(users).values({
                        id: userId,
                        name: userName,
                    })
                    await ctx.db.insert(groupMembers).values({
                        groupId,
                        userId,
                    })
                }

                return { success: true, id: newGroup[0]?.id }
            } catch (error) {
                console.error('Error inserting group:', error)
                throw new Error('Failed to create group')
            }
        }),
})
