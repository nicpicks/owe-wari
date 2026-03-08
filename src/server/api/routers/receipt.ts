import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import { env } from '~/env'

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export const receiptRouter = createTRPCRouter({
    scan: publicProcedure
        .input(
            z.object({
                imageBase64: z.string(),
                mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
            })
        )
        .mutation(async ({ input }) => {
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 256,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: input.mimeType,
                                    data: input.imageBase64,
                                },
                            },
                            {
                                type: 'text',
                                text: 'Extract the total amount due from this receipt, including all taxes and charges. Return ONLY valid JSON in this exact format: {"amount": <number>}. Use a plain number with no currency symbol. If no total is found, return {"amount": null}.',
                            },
                        ],
                    },
                ],
            })

            const text =
                response.content[0]?.type === 'text' ? response.content[0].text : ''
            const match = text.match(/\{[\s\S]*\}/)
            const parsed = JSON.parse(match?.[0] ?? '{}') as {
                amount?: number | null
            }
            return { amount: parsed.amount ?? null }
        }),
})
