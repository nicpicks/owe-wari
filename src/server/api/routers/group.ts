import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import {
    groups,
    users,
    groupMembers,
    groupCurrencies,
    groupRates,
} from '~/server/db/schema'
import { isSupportedCurrency } from '~/lib/currencies'
import { ulid } from 'ulid'

export const groupRouter = createTRPCRouter({
    create: publicProcedure
        .input(
            z.object({
                name: z.string().min(1),
                currency: z.string().min(1),
                currencies: z.array(z.string().min(1)).min(1),
                description: z.string(),
                userNames: z.array(z.string().min(1)),
                defaultPayee: z.string(),
                tripUrl: z.string().url().max(512).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                if (!input.currencies.includes(input.currency)) {
                    throw new Error('Default currency must be in the currencies list')
                }

                const groupId = ulid()
                const members = input.userNames.map((name) => ({ id: ulid(), name }))
                const defaultPayeeId =
                    members.find((m) => m.name === input.defaultPayee)?.id ?? null

                await ctx.db.transaction(async (tx) => {
                    if (members.length > 0) {
                        await tx.insert(users).values(members)
                    }

                    await tx.insert(groups).values({
                        id: groupId,
                        name: input.name,
                        currency: input.currency,
                        description: input.description,
                        defaultPayee: defaultPayeeId,
                        tripUrl: input.tripUrl ?? null,
                    })

                    await tx
                        .insert(groupCurrencies)
                        .values(input.currencies.map((code) => ({ groupId, code })))

                    if (members.length > 0) {
                        await tx
                            .insert(groupMembers)
                            .values(members.map((m) => ({ groupId, userId: m.id })))
                    }
                })

                return { success: true, id: groupId }
            } catch (error) {
                console.error('Error inserting group:', error)
                throw new Error('Failed to create group')
            }
        }),

    getGroup: publicProcedure
        .input(z.object({ groupId: z.string() }))
        .query(async ({ ctx, input }) => {
            try {
                const result = await ctx.db
                    .select({
                        id: groups.id,
                        name: groups.name,
                        currency: groups.currency,
                        tripUrl: groups.tripUrl,
                    })
                    .from(groups)
                    .where(eq(groups.id, input.groupId))
                    .execute()

                return result[0] ?? null
            } catch (error) {
                console.error('Error fetching group:', error)
                throw new Error('Failed to fetch group')
            }
        }),

    getCurrencies: publicProcedure
        .input(z.object({ groupId: z.string() }))
        .query(async ({ ctx, input }) => {
            try {
                const [group] = await ctx.db
                    .select({ defaultCode: groups.currency })
                    .from(groups)
                    .where(eq(groups.id, input.groupId))
                    .execute()

                if (!group) return []

                const rows = await ctx.db
                    .select({ code: groupCurrencies.code })
                    .from(groupCurrencies)
                    .where(eq(groupCurrencies.groupId, input.groupId))
                    .execute()

                return rows.map(({ code }) => ({
                    code,
                    isDefault: code === group.defaultCode,
                }))
            } catch (error) {
                console.error('Error fetching currencies:', error)
                throw new Error('Failed to fetch currencies')
            }
        }),

    updateCurrencies: publicProcedure
        .input(
            z.object({
                groupId: z.string(),
                currencies: z
                    .array(z.string().trim().toUpperCase().length(3))
                    .min(1),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const codes = Array.from(new Set(input.currencies))
            const unsupported = codes.filter((code) => !isSupportedCurrency(code))
            if (unsupported.length > 0) {
                throw new Error(`Unsupported currency code(s): ${unsupported.join(', ')}`)
            }

            const [group] = await ctx.db
                .select({ defaultCode: groups.currency })
                .from(groups)
                .where(eq(groups.id, input.groupId))
                .execute()

            if (!group) {
                throw new Error('No group found with the provided ID')
            }
            if (!codes.includes(group.defaultCode)) {
                throw new Error('The default currency cannot be removed')
            }

            try {
                const existing = await ctx.db
                    .select({ code: groupCurrencies.code })
                    .from(groupCurrencies)
                    .where(eq(groupCurrencies.groupId, input.groupId))
                    .execute()

                const existingCodes = new Set(existing.map((row) => row.code))
                const toAdd = codes.filter((code) => !existingCodes.has(code))
                const toRemove = [...existingCodes].filter((code) => !codes.includes(code))

                await ctx.db.transaction(async (tx) => {
                    if (toRemove.length > 0) {
                        await tx
                            .delete(groupCurrencies)
                            .where(
                                and(
                                    eq(groupCurrencies.groupId, input.groupId),
                                    inArray(groupCurrencies.code, toRemove)
                                )
                            )
                    }
                    if (toAdd.length > 0) {
                        await tx
                            .insert(groupCurrencies)
                            .values(toAdd.map((code) => ({ groupId: input.groupId, code })))
                    }
                })

                return { success: true }
            } catch (error) {
                console.error('Error updating currencies:', error)
                throw new Error('Failed to update currencies')
            }
        }),

    /**
     * Conversion rates the group has agreed on, quoted per unit of the group's
     * default currency: `rate` is how many units of `code` one unit of the
     * default buys (default SGD + code MYR + rate 3.5 → "S$1 = RM3.50").
     * Currencies without a saved rate are simply absent — callers fall back to
     * the baseline table in `~/lib/fx-rates`.
     */
    getRates: publicProcedure
        .input(z.object({ groupId: z.string() }))
        .query(async ({ ctx, input }) => {
            try {
                const rows = await ctx.db
                    .select({
                        code: groupRates.code,
                        rate: groupRates.rate,
                        updatedAt: groupRates.updatedAt,
                    })
                    .from(groupRates)
                    .where(eq(groupRates.groupId, input.groupId))
                    .execute()

                return rows.map((row) => ({
                    code: row.code,
                    rate: parseFloat(row.rate),
                    updatedAt: row.updatedAt,
                }))
            } catch (error) {
                console.error('Error fetching rates:', error)
                throw new Error('Failed to fetch conversion rates')
            }
        }),

    setRate: publicProcedure
        .input(
            z.object({
                groupId: z.string(),
                code: z.string().trim().toUpperCase().length(3),
                // Units of `code` per 1 unit of the group's default currency
                rate: z.number().positive().finite().max(1_000_000),
            })
        )
        .mutation(async ({ ctx, input }) => {
            if (!isSupportedCurrency(input.code)) {
                throw new Error(`Unsupported currency code: ${input.code}`)
            }

            const [group] = await ctx.db
                .select({ defaultCode: groups.currency })
                .from(groups)
                .where(eq(groups.id, input.groupId))
                .execute()

            if (!group) {
                throw new Error('No group found with the provided ID')
            }
            if (input.code === group.defaultCode) {
                throw new Error(
                    `${input.code} is the group's default currency — it needs no conversion rate`
                )
            }

            const [enabled] = await ctx.db
                .select({ code: groupCurrencies.code })
                .from(groupCurrencies)
                .where(
                    and(
                        eq(groupCurrencies.groupId, input.groupId),
                        eq(groupCurrencies.code, input.code)
                    )
                )
                .execute()

            if (!enabled) {
                throw new Error(`Currency ${input.code} is not enabled for this group`)
            }

            try {
                await ctx.db
                    .insert(groupRates)
                    .values({
                        groupId: input.groupId,
                        code: input.code,
                        rate: input.rate.toString(),
                    })
                    .onConflictDoUpdate({
                        target: [groupRates.groupId, groupRates.code],
                        set: { rate: input.rate.toString(), updatedAt: new Date() },
                    })

                return { success: true, code: input.code, rate: input.rate }
            } catch (error) {
                console.error('Error saving rate:', error)
                throw new Error('Failed to save conversion rate')
            }
        }),

    /** Drop a saved rate so the group falls back to the baseline quote. */
    deleteRate: publicProcedure
        .input(
            z.object({
                groupId: z.string(),
                code: z.string().trim().toUpperCase().length(3),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                await ctx.db
                    .delete(groupRates)
                    .where(
                        and(
                            eq(groupRates.groupId, input.groupId),
                            eq(groupRates.code, input.code)
                        )
                    )

                return { success: true }
            } catch (error) {
                console.error('Error deleting rate:', error)
                throw new Error('Failed to delete conversion rate')
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

    addMember: publicProcedure
        .input(z.object({ groupId: z.string(), name: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            try {
                const userId = ulid()
                await ctx.db.transaction(async (tx) => {
                    await tx.insert(users).values({ id: userId, name: input.name })
                    await tx
                        .insert(groupMembers)
                        .values({ groupId: input.groupId, userId })
                })
                return { id: userId, name: input.name }
            } catch (error) {
                console.error('Error adding member:', error)
                throw new Error('Failed to add member')
            }
        }),

    updateTripLink: publicProcedure
        .input(
            z.object({
                groupId: z.string(),
                // Empty string unlinks the trip
                tripUrl: z.union([z.literal(''), z.string().url().max(512)]),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const result = await ctx.db
                    .update(groups)
                    .set({ tripUrl: input.tripUrl || null })
                    .where(eq(groups.id, input.groupId))
                    .returning({ id: groups.id })

                if (result.length === 0) {
                    throw new Error('No group found with the provided ID')
                }

                return { success: true }
            } catch (error) {
                console.error('Error updating trip link', error)
                throw new Error('Failed to update trip link')
            }
        }),
})
