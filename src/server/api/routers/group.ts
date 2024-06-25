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

    getDefaultPayee: publicProcedure
        .input(z.object({ groupId: z.string() }))
        .query(async ({ ctx, input }) => {
            try {
                const group = await ctx.db
                    .select({ defaultPayee: groups.defaultPayee })
                    .from(groups)
                    .where(eq(groups.id, input.groupId))
                    .execute()

                return group[0]?.defaultPayee
            } catch (error) {
                console.error('Error fetching default payee:', error)
                throw new Error('Failed to fetch default payee')
            }
        }),

    updateDefaultPayee: publicProcedure
        .input(z.object({ groupId: z.string(), defaultPayee: z.string() }))
        .mutation(async ({ ctx, input }) => {
            try {
                const result = await ctx.db
                    .update(groups)
                    .set({ defaultPayee: input.defaultPayee })
                    .where(eq(groups.id, input.groupId))
                    .execute()

                if (!result) {
                    throw new Error('No group found with the provided ID')
                }

                return {
                    success: true,
                    message: 'Default payee updated successfully',
                }
            } catch (error) {
                console.error('Error updating default payee', error)
                throw new Error('Failed to update default payee')
            }
        }),
})
