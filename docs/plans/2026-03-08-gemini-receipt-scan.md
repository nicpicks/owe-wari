# Gemini Receipt Scan Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Anthropic SDK with Google Gemini (`gemini-1.5-flash`) for receipt amount extraction.

**Architecture:** Swap `@anthropic-ai/sdk` for `@google/generative-ai` in the server-side `receipt.ts` router. Rename the API key env var. No frontend, schema, or E2E test changes needed since tests mock at the network level.

**Tech Stack:** `@google/generative-ai`, tRPC, Next.js App Router, Zod, Playwright (existing E2E)

---

### Task 1: Swap npm packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-updated)

**Step 1: Uninstall Anthropic SDK and install Gemini SDK**

```bash
npm uninstall @anthropic-ai/sdk
npm install @google/generative-ai
```

**Step 2: Verify install**

```bash
node -e "require('@google/generative-ai'); console.log('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap @anthropic-ai/sdk for @google/generative-ai"
```

---

### Task 2: Update environment variable

**Files:**
- Modify: `src/env.js:9,30` — rename `ANTHROPIC_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY`
- Modify: `.env` — update key name and value
- Modify: `.env.example` — update key name

**Step 1: Update `src/env.js`**

In the `server` block, change:
```js
ANTHROPIC_API_KEY: z.string().min(1),
```
to:
```js
GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
```

In the `runtimeEnv` block, change:
```js
ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
```
to:
```js
GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
```

**Step 2: Update `.env`**

Change:
```
# Anthropic (for receipt scanning)
ANTHROPIC_API_KEY="sk-ant-..."
```
to:
```
# Google Gemini (for receipt scanning)
GOOGLE_GENERATIVE_AI_API_KEY="your-google-api-key"
```
(paste your real Gemini API key as the value)

**Step 3: Update `.env.example`**

Change:
```
# Anthropic (for receipt scanning)
ANTHROPIC_API_KEY="your-anthropic-api-key"
```
to:
```
# Google Gemini (for receipt scanning)
GOOGLE_GENERATIVE_AI_API_KEY="your-google-api-key"
```

**Step 4: Commit**

```bash
git add src/env.js .env.example
git commit -m "chore: rename API key env var to GOOGLE_GENERATIVE_AI_API_KEY"
```
(Do NOT commit `.env` — it's gitignored)

---

### Task 3: Rewrite receipt router to use Gemini

**Files:**
- Modify: `src/server/api/routers/receipt.ts`

**Step 1: Verify existing E2E tests pass (they are the test harness)**

```bash
npm run test:e2e
```
Expected: 5 passed (tests mock the network, so they pass regardless of SDK)

**Step 2: Rewrite `src/server/api/routers/receipt.ts`**

Replace the entire file with:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'
import { env } from '~/env'

const genAI = new GoogleGenerativeAI(env.GOOGLE_GENERATIVE_AI_API_KEY)

export const receiptRouter = createTRPCRouter({
    scan: publicProcedure
        .input(
            z.object({
                imageBase64: z.string(),
                mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
            })
        )
        .mutation(async ({ input }) => {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

            const result = await model.generateContent([
                {
                    inlineData: {
                        data: input.imageBase64,
                        mimeType: input.mimeType,
                    },
                },
                'Extract the total amount due from this receipt, including all taxes and charges. Return ONLY valid JSON in this exact format: {"amount": <number>}. Use a plain number with no currency symbol. If no total is found, return {"amount": null}.',
            ])

            const text = result.response.text()
            const match = text.match(/\{[\s\S]*\}/)
            const parsed = JSON.parse(match?.[0] ?? '{}') as {
                amount?: number | null
            }
            return { amount: parsed.amount ?? null }
        }),
})
```

**Step 3: Run E2E tests to confirm nothing broke**

```bash
npm run test:e2e
```
Expected: 5 passed

**Step 4: Commit**

```bash
git add src/server/api/routers/receipt.ts
git commit -m "feat: migrate receipt scan from Anthropic to Gemini 1.5 Flash"
```

---

### Task 4: Manual smoke test

**Step 1: Start the dev server (if not already running)**

```bash
npm run dev
```

**Step 2: Create a group and navigate to add expense**

Go to `http://localhost:3000`, create a group, then navigate to the create expense page.

**Step 3: Click "Scan receipt" and upload a receipt photo**

Verify the amount field auto-populates with the total from the receipt.

**Step 4: Push the branch**

```bash
git push
```
