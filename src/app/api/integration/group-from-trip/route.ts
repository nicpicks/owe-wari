import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createCaller } from '~/server/api/root'
import { createTRPCContext } from '~/server/api/trpc'
import { isSupportedCurrency, DEFAULT_CURRENCY } from '~/lib/currencies'

/**
 * Cross-app integration endpoint: create an expense group from an external
 * trip planner (e.g. a Jiogo trip). Creates a group with the given members
 * and stores a back-link to the trip, so the two apps can deep-link into
 * each other.
 *
 * Deliberately unauthenticated + CORS-open: group creation is already a
 * public tRPC mutation, and the returned group URL (ULID) is the only
 * capability handed out — same access model as the rest of the app.
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

const bodySchema = z.object({
    name: z.string().trim().min(1).max(256),
    description: z.string().trim().max(256).optional(),
    memberNames: z.array(z.string().trim().min(1).max(256)).min(1).max(50),
    currency: z.string().trim().toUpperCase().length(3).default(DEFAULT_CURRENCY),
    currencies: z
        .array(z.string().trim().toUpperCase().length(3))
        .max(20)
        .optional(),
    tripUrl: z.string().url().max(512).optional(),
})

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: 400, headers: CORS_HEADERS }
        )
    }

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid request', details: parsed.error.flatten() },
            { status: 400, headers: CORS_HEADERS }
        )
    }

    const input = parsed.data
    const currencies = Array.from(
        new Set([input.currency, ...(input.currencies ?? [])])
    )
    const unknown = currencies.filter((code) => !isSupportedCurrency(code))
    if (unknown.length > 0) {
        return NextResponse.json(
            { error: `Unsupported currency code(s): ${unknown.join(', ')}` },
            { status: 400, headers: CORS_HEADERS }
        )
    }

    try {
        const api = createCaller(
            await createTRPCContext({ headers: new Headers(request.headers) })
        )
        const result = await api.group.create({
            name: input.name,
            description: input.description ?? '',
            currency: input.currency,
            currencies,
            userNames: input.memberNames,
            defaultPayee: '',
            tripUrl: input.tripUrl,
        })

        const origin = new URL(request.url).origin
        return NextResponse.json(
            { groupId: result.id, url: `${origin}/groups/${result.id}` },
            { status: 201, headers: CORS_HEADERS }
        )
    } catch (error) {
        console.error('Error creating group from trip:', error)
        return NextResponse.json(
            { error: 'Failed to create group' },
            { status: 500, headers: CORS_HEADERS }
        )
    }
}
