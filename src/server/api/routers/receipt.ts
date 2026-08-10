import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import { CATEGORIES, isCategory } from '~/lib/categorize'
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
                                text: `Extract all line items, the final total, and a category from this receipt.
Return ONLY valid JSON in this exact format:
{"items":[{"name":"<item name>","amount":<number>}],"total":<number>,"category":"<category>"}
Rules:
- Use plain numbers with no currency symbols
- Omit quantities — if a line shows "2x Coffee $10.00", emit one item "Coffee" at 5.00
- Include tax and service charge as separate line items if shown
- If no items are found, use []
- If no total is found, use null for total
- category must be exactly one of: ${CATEGORIES.join(', ')}
- Groceries is for supermarket/convenience shopping, Food for eating out or delivery,
  Stay for accommodation, Transport for travel, Activities for tickets and experiences
- Use "General" if the receipt does not clearly fit one of them`,
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
                category?: string | null
            }
            // 'General' is the form's default, so it reads the same as no answer.
            const category =
                parsed.category && isCategory(parsed.category) && parsed.category !== 'General'
                    ? parsed.category
                    : null
            return {
                total: parsed.total ?? null,
                items: parsed.items ?? [],
                category,
            }
        }),
})
