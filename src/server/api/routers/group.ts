import { z } from 'zod'
import { eq } from 'drizzle-orm'

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
                defaultPayee: z.string(),
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

                let defaultPayeeId = ''

                for (const userName of input.userNames) {
                    const userId = ulid()

                    if (userName === input.defaultPayee) {
                        defaultPayeeId = userId
                    }

                    await ctx.db.insert(users).values({
                        id: userId,
                        name: userName,
                    })
                    await ctx.db.insert(groupMembers).values({
                        groupId,
                        userId,
                    })
                }

                debugger
                if (defaultPayeeId) {
                    await ctx.db
                        .update(groups)
                        .set({
                            defaultPayee: defaultPayeeId,
                        })
                        .where(eq(groups.id, groupId))
                        .execute()
                }

                return { success: true, id: newGroup[0]?.id }
            } catch (error) {
                console.error('Error inserting group:', error)
                throw new Error('Failed to create group')
            }
        }),

    getUsers: publicProcedure
        .input(z.object({ groupId: z.string() }))
        .query(async ({ ctx, input }) => {
            try {
                const usersInGroup = await ctx.db
                    .select({ id: users.id, name: users.name })
                    .from(users)
                    .innerJoin(groupMembers, eq(users.id, groupMembers.userId))
                    .where(eq(groupMembers.groupId, input.groupId))
                    .execute()

                return usersInGroup
            } catch (error) {
                console.error('Error fetching users:', error)
                throw new Error('Failed to fetch users')
            }
        }),
})
