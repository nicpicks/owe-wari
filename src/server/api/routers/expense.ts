import { z } from 'zod'
import { eq, sql, and, isNull, isNotNull, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import {
    expenses,
    expenseAudits,
    expenseSplits,
    groupMembers,
    groupCurrencies,
    groups,
    settlements,
    users,
} from '~/server/db/schema'

const notDeleted = isNull(expenses.deletedAt)

export const expenseRouter = createTRPCRouter({
    create: publicProcedure
        .input(
            z.object({
                groupId: z.string(),
                paidByUserId: z.string(),
                createdByUserId: z.string().optional(),
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
                            createdByUserId: input.createdByUserId ?? input.paidByUserId,
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
                throw new Error(error instanceof Error ? error.message : 'Failed to create expense')
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
                    .where(and(eq(expenses.groupId, input.groupId), notDeleted))
                    .orderBy(desc(expenses.expenseDate), desc(expenses.id))
                    .execute()

                return expensesInGroup
            } catch (error) {
                console.error('Error getting expenses:', error)
                throw new Error('Failed to get expenses')
            }
        }),

    getHistory: publicProcedure
        .input(z.object({ groupId: z.string().min(1) }))
        .query(async ({ ctx, input }) => {
            try {
                const payerUsers = alias(users, 'payer_users')
                const receiverUsers = alias(users, 'receiver_users')

                const [expenseRows, settlementRows, auditRows, deleteRows] = await Promise.all([
                    ctx.db
                        .select({
                            id: expenses.id,
                            title: expenses.title,
                            amount: expenses.amount,
                            currency: expenses.currency,
                            actorId: expenses.paidByUserId,
                            actorName: users.name,
                            at: expenses.createdAt,
                        })
                        .from(expenses)
                        .innerJoin(users, eq(users.id, expenses.paidByUserId))
                        .where(eq(expenses.groupId, input.groupId))
                        .execute(),
                    ctx.db
                        .select({
                            id: settlements.id,
                            amount: settlements.amount,
                            currency: settlements.currency,
                            actorId: settlements.payerId,
                            actorName: payerUsers.name,
                            receiverId: settlements.receiverId,
                            receiverName: receiverUsers.name,
                            at: settlements.settledAt,
                        })
                        .from(settlements)
                        .innerJoin(payerUsers, eq(payerUsers.id, settlements.payerId))
                        .innerJoin(receiverUsers, eq(receiverUsers.id, settlements.receiverId))
                        .where(eq(settlements.groupId, input.groupId))
                        .execute(),
                    ctx.db
                        .select({
                            id: expenseAudits.id,
                            expenseId: expenseAudits.expenseId,
                            title: expenses.title,
                            actorId: expenseAudits.actorId,
                            actorName: users.name,
                            fieldsChanged: expenseAudits.fieldsChanged,
                            at: expenseAudits.createdAt,
                        })
                        .from(expenseAudits)
                        .innerJoin(expenses, eq(expenses.id, expenseAudits.expenseId))
                        .innerJoin(users, eq(users.id, expenseAudits.actorId))
                        .where(eq(expenseAudits.groupId, input.groupId))
                        .execute(),
                    ctx.db
                        .select({
                            id: expenses.id,
                            title: expenses.title,
                            actorId: expenses.createdByUserId,
                            actorName: users.name,
                            at: expenses.deletedAt,
                        })
                        .from(expenses)
                        .innerJoin(users, eq(users.id, expenses.createdByUserId))
                        .where(and(eq(expenses.groupId, input.groupId), isNotNull(expenses.deletedAt)))
                        .execute(),
                ])

                const events = [
                    ...expenseRows.map((r) => ({ type: 'expense' as const, ...r })),
                    ...settlementRows.map((r) => ({ type: 'settlement' as const, ...r })),
                    ...auditRows.map((r) => ({ type: 'edit' as const, ...r })),
                    ...deleteRows
                        .filter((r): r is typeof r & { at: Date } => r.at !== null)
                        .map((r) => ({ type: 'delete' as const, ...r })),
                ]

                events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

                return events
            } catch (error) {
                console.error('Error getting history:', error)
                throw new Error('Failed to get history')
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
                    .where(and(eq(expenses.id, input.expenseId), notDeleted))
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

    update: publicProcedure
        .input(
            z.object({
                expenseId: z.number(),
                title: z.string().min(1).optional(),
                category: z.string().optional(),
                notes: z.string().optional(),
                expenseDate: z.date().optional(),
                paidByUserId: z.string().optional(),
                amount: z.number().positive().optional(),
                actorId: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { expenseId, actorId, amount, ...rest } = input
            const patch: Record<string, unknown> = Object.fromEntries(
                Object.entries(rest).filter(([, v]) => v !== undefined)
            )
            if (amount !== undefined) patch.amount = amount.toString()
            if (Object.keys(patch).length === 0) return { success: true }

            try {
                await ctx.db.transaction(async (trx) => {
                    const [current] = await trx
                        .select({
                            groupId: expenses.groupId,
                            createdByUserId: expenses.createdByUserId,
                            deletedAt: expenses.deletedAt,
                            title: expenses.title,
                            category: expenses.category,
                            notes: expenses.notes,
                            expenseDate: expenses.expenseDate,
                            paidByUserId: expenses.paidByUserId,
                            amount: expenses.amount,
                        })
                        .from(expenses)
                        .where(eq(expenses.id, expenseId))
                        .execute()

                    if (!current) {
                        throw new Error('Expense not found')
                    }
                    if (current.deletedAt !== null) {
                        throw new Error('Cannot edit a deleted expense')
                    }

                    const changed: string[] = []
                    for (const key of Object.keys(patch)) {
                        const next = patch[key]
                        const prev = (current as Record<string, unknown>)[key]
                        if (key === 'amount') {
                            if (Math.abs(parseFloat(next as string) - parseFloat(prev as string)) > 0.001) {
                                changed.push(key)
                            }
                        } else if (next instanceof Date && prev instanceof Date) {
                            if (next.getTime() !== prev.getTime()) changed.push(key)
                        } else if (next !== prev) {
                            changed.push(key)
                        }
                    }

                    if (changed.length === 0) return

                    await trx
                        .update(expenses)
                        .set(patch)
                        .where(eq(expenses.id, expenseId))
                        .execute()

                    if (changed.includes('amount') && amount !== undefined) {
                        const oldAmount = parseFloat(current.amount)
                        if (oldAmount > 0) {
                            const ratio = amount / oldAmount
                            const splits = await trx
                                .select({ id: expenseSplits.id, amount: expenseSplits.amount })
                                .from(expenseSplits)
                                .where(eq(expenseSplits.expenseId, expenseId))
                                .execute()
                            for (const split of splits) {
                                await trx
                                    .update(expenseSplits)
                                    .set({ amount: (parseFloat(split.amount) * ratio).toString() })
                                    .where(eq(expenseSplits.id, split.id))
                                    .execute()
                            }
                        }
                    }

                    await trx.insert(expenseAudits).values({
                        expenseId,
                        groupId: current.groupId,
                        actorId: actorId ?? current.createdByUserId,
                        fieldsChanged: changed,
                    })
                })
                return { success: true }
            } catch (error) {
                console.error('Error updating expense:', error)
                throw new Error('Failed to update expense')
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
                    return { defaultTotal: 0, defaultCurrency: 'SGD', otherTotals: [] }
                }

                const [defaultRow] = await ctx.db
                    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
                    .from(expenses)
                    .where(
                        and(
                            eq(expenses.groupId, input.groupId),
                            eq(expenses.currency, group.defaultCode),
                            notDeleted
                        )
                    )
                    .execute()

                const otherRows = await ctx.db
                    .select({
                        currency: expenses.currency,
                        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
                    })
                    .from(expenses)
                    .where(
                        and(
                            eq(expenses.groupId, input.groupId),
                            sql`${expenses.currency} <> ${group.defaultCode}`,
                            notDeleted
                        )
                    )
                    .groupBy(expenses.currency)
                    .execute()

                return {
                    defaultTotal: parseFloat(defaultRow?.total ?? '0'),
                    defaultCurrency: group.defaultCode,
                    otherTotals: otherRows.map((r) => ({
                        currency: r.currency,
                        total: parseFloat(r.total),
                    })),
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
                    .where(and(eq(expenses.groupId, groupId), notDeleted))
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
                    .where(and(eq(expenses.groupId, groupId), notDeleted))
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

    getUserSpend: publicProcedure
        .input(z.object({ groupId: z.string(), userId: z.string() }))
        .query(async ({ ctx, input }) => {
            const { groupId, userId } = input
            try {
                const [paidRows, shareRows, countRow] = await Promise.all([
                    ctx.db
                        .select({
                            currency: expenses.currency,
                            total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
                        })
                        .from(expenses)
                        .where(
                            and(
                                eq(expenses.groupId, groupId),
                                eq(expenses.paidByUserId, userId),
                                notDeleted
                            )
                        )
                        .groupBy(expenses.currency)
                        .execute(),
                    ctx.db
                        .select({
                            currency: expenses.currency,
                            total: sql<string>`COALESCE(SUM(${expenseSplits.amount}), 0)`,
                        })
                        .from(expenseSplits)
                        .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
                        .where(
                            and(
                                eq(expenses.groupId, groupId),
                                eq(expenseSplits.userId, userId),
                                notDeleted
                            )
                        )
                        .groupBy(expenses.currency)
                        .execute(),
                    ctx.db
                        .select({ count: sql<string>`COUNT(*)` })
                        .from(expenses)
                        .where(
                            and(
                                eq(expenses.groupId, groupId),
                                eq(expenses.paidByUserId, userId),
                                notDeleted
                            )
                        )
                        .execute(),
                ])

                const byCurrency = new Map<string, { paid: number; share: number }>()
                for (const r of paidRows) {
                    const entry = byCurrency.get(r.currency) ?? { paid: 0, share: 0 }
                    entry.paid = parseFloat(r.total)
                    byCurrency.set(r.currency, entry)
                }
                for (const r of shareRows) {
                    const entry = byCurrency.get(r.currency) ?? { paid: 0, share: 0 }
                    entry.share = parseFloat(r.total)
                    byCurrency.set(r.currency, entry)
                }

                return {
                    paidExpenseCount: parseInt(countRow[0]?.count ?? '0', 10),
                    byCurrency: Array.from(byCurrency.entries()).map(([currency, v]) => ({
                        currency,
                        paid: v.paid,
                        share: v.share,
                    })),
                }
            } catch (error) {
                console.error('Error getting user spend:', error)
                throw new Error('Failed to get user spend')
            }
        }),

    delete: publicProcedure
        .input(z.object({ expenseId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            try {
                await ctx.db
                    .update(expenses)
                    .set({ deletedAt: new Date() })
                    .where(and(eq(expenses.id, input.expenseId), notDeleted))
                    .execute()
                return { success: true }
            } catch (error) {
                console.error('Error deleting expense:', error)
                throw new Error('Failed to delete expense')
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
