# Design: Swap Anthropic → Google Gemini for Receipt Scanning

**Date:** 2026-03-08
**Status:** Approved

## Problem

The receipt scanning feature uses `@anthropic-ai/sdk` with `claude-haiku-4-5`. The team wants to use Google Gemini (`gemini-1.5-flash`) instead.

## Decision

Replace the Anthropic SDK with `@google/generative-ai` (Option A — official Google SDK). The tRPC input/output schema, frontend component, and E2E tests are unchanged since the mocks are network-level.

## Changes

| File | Change |
|---|---|
| `package.json` | Remove `@anthropic-ai/sdk`, add `@google/generative-ai` |
| `src/env.js` | Rename `ANTHROPIC_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY` |
| `.env` / `.env.example` | Update key name |
| `src/server/api/routers/receipt.ts` | Rewrite API call using `GoogleGenerativeAI` client with `gemini-1.5-flash` |

## API Mapping

```ts
// Before (Anthropic)
const client = new Anthropic({ apiKey })
client.messages.create({ model: 'claude-haiku-4-5-20251001', content: [image, text] })

// After (Gemini)
const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
model.generateContent([{ inlineData: { data: base64, mimeType } }, promptText])
```

Same prompt, same `{ amount: number | null }` JSON output parsing.
