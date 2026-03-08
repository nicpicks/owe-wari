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
                max_tokens: 1024,
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
                                text: `Extract all line items and the final total from this receipt.
Return ONLY valid JSON in this exact format:
{"items":[{"name":"<item name>","amount":<number>}],"total":<number>}
Rules:
- Use plain numbers with no currency symbols
- Omit quantities — if a line shows "2x Coffee $10.00", emit one item "Coffee" at 5.00
- Include tax and service charge as separate line items if shown
- If no items are found, use []
- If no total is found, use null for total`,
                            },
                        ],
                    },
                ],
            })

            const text =
                response.content[0]?.type === 'text' ? response.content[0].text : ''
            const match = text.match(/\{[\s\S]*\}/)
            const parsed = JSON.parse(match?.[0] ?? '{}') as {
                items?: { name: string; amount: number }[]
                total?: number | null
            }
            return {
                total: parsed.total ?? null,
                items: parsed.items ?? [],
            }
        }),
})
