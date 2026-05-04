import { z } from 'zod'
import { api } from '~/trpc/server'

/**
 * Tool catalog for the owe-wari MCP server.
 *
 * Each tool delegates to a tRPC procedure — no business logic lives here.
 * When you add a new tRPC mutation that callers might want to invoke via
 * natural language, add it here too. See docs/MCP.md.
 */

const groupIdSchema = z.string().length(26).describe('The group ULID (26 chars). Find this in the group URL.')

export const mcpTools = {
    get_group: {
        description:
            'Get a group by its ULID, including members and enabled currencies. Use this to confirm a group exists and to discover member IDs and currency codes before creating expenses or settling up.',
        inputSchema: { groupId: groupIdSchema },
        handler: async ({ groupId }: { groupId: string }) => {
            const [group, members, currencies] = await Promise.all([
                api.group.getGroup({ groupId }),
                api.group.getUsers({ groupId }),
                api.group.getCurrencies({ groupId }),
            ])
            if (!group) throw new Error(`Group ${groupId} not found`)
            return { group, members, currencies }
        },
    },

    list_expenses: {
        description: 'List all expenses in a group. Returns id, title, amount, currency, category, notes, and date for each.',
        inputSchema: { groupId: groupIdSchema },
        handler: async ({ groupId }: { groupId: string }) =>
            api.expense.getExpenses({ groupId }),
    },

    create_expense: {
        description:
            'Create a new expense in a group. CONFIRM WITH THE USER before calling. Splits are even across all members by default; pass splitUserIds to restrict the even-split to specific members, or splitAmounts for explicit per-user amounts. If both are provided, splitAmounts takes precedence.',
        inputSchema: {
            groupId: groupIdSchema,
            paidByUserId: z.string().length(26).describe('The ULID of the user who paid'),
            title: z.string().min(1),
            amount: z.number().positive(),
            currency: z
                .string()
                .length(3)
                .describe('3-letter ISO currency code, must be enabled for the group'),
            category: z.string().optional(),
            notes: z.string().optional(),
            expenseDate: z
                .string()
                .datetime()
                .optional()
                .describe('ISO 8601 datetime; defaults to now'),
            splitUserIds: z
                .array(z.string().length(26))
                .optional()
                .describe('User IDs to split across (even split). Omit to split across all members.'),
            splitAmounts: z
                .array(z.object({ userId: z.string().length(26), amount: z.number().positive() }))
                .optional()
                .describe('Manual split amounts. Sum must equal `amount`. If provided, splitUserIds is ignored.'),
        },
        handler: async (input: {
            groupId: string
            paidByUserId: string
            title: string
            amount: number
            currency: string
            category?: string
            notes?: string
            expenseDate?: string
            splitUserIds?: string[]
            splitAmounts?: { userId: string; amount: number }[]
        }) =>
            api.expense.create({
                ...input,
                expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
            }),
    },

    get_balances: {
        description:
            'Get net balances per (user, currency) for a group. Positive netBalance means the user is owed; negative means they owe.',
        inputSchema: { groupId: groupIdSchema },
        handler: async ({ groupId }: { groupId: string }) =>
            api.expense.getBalances({ groupId }),
    },

    settle_up: {
        description:
            'Record a settlement payment from one user to another. CONFIRM WITH THE USER before calling. Supports multi-currency lines (e.g., paying back $30 USD plus S$50 SGD in one settlement).',
        inputSchema: {
            groupId: groupIdSchema,
            payerId: z.string().length(26).describe('User who is paying'),
            receiverId: z.string().length(26).describe('User receiving the payment'),
            lines: z
                .array(
                    z.object({
                        currency: z.string().length(3),
                        amount: z.number().positive(),
                    })
                )
                .min(1),
        },
        handler: async (input: {
            groupId: string
            payerId: string
            receiverId: string
            lines: { currency: string; amount: number }[]
        }) => api.expense.settleUp(input),
    },

    add_member: {
        description: "Add a new member to a group by name. CONFIRM WITH THE USER before calling. Returns the new member's ID and name.",
        inputSchema: {
            groupId: groupIdSchema,
            name: z.string().min(1),
        },
        handler: async (input: { groupId: string; name: string }) =>
            api.group.addMember(input),
    },
} as const
