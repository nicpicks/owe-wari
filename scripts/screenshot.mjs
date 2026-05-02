/**
 * Screenshot script — captures every page of owe-wari.
 *
 * Usage:  node scripts/screenshot.mjs
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000
 *   - DB running and seeded via this script (it creates a fresh test group)
 */

import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots')
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const VIEWPORT = { width: 1280, height: 800 }

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomName() {
    const names = [
        'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
        'Frank', 'Grace', 'Henry', 'Isla', 'Jack',
    ]
    return names[Math.floor(Math.random() * names.length)]
}

function uniqueNames(count) {
    const pool = [
        'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
        'Frank', 'Grace', 'Henry', 'Isla', 'Jack',
    ]
    const shuffled = pool.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
}

// tRPC v10 with superjson transformer + httpBatchStreamLink wire format:
//   mutations → POST /api/trpc/<proc>  body: {"0":{"json":<input>}}
//   queries   → GET  /api/trpc/<proc>?batch=1&input={"0":{"json":<input>}}
async function callTRPC(procedure, input, type = 'mutation') {
    if (type === 'query') {
        const encoded = encodeURIComponent(JSON.stringify({ '0': { json: input } }))
        const url = `${BASE_URL}/api/trpc/${procedure}?batch=1&input=${encoded}`
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(`tRPC ${procedure} failed (${res.status}): ${text}`)
        }
        const json = await res.json()
        return json[0]?.result?.data?.json
    } else {
        const url = `${BASE_URL}/api/trpc/${procedure}?batch=1`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ '0': { json: input } }),
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(`tRPC ${procedure} failed (${res.status}): ${text}`)
        }
        const json = await res.json()
        return json[0]?.result?.data?.json
    }
}

async function screenshot(page, name) {
    const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`)
    await page.screenshot({ path: filePath, fullPage: true })
    console.log(`  ✓  screenshots/${name}.png`)
}

async function waitForNetworkIdle(page, timeout = 5000) {
    await page.waitForNetworkIdle({ idleTime: 500, timeout }).catch(() => {})
}

// ---------------------------------------------------------------------------
// Seed: create a test group via tRPC
// ---------------------------------------------------------------------------

async function seedTestGroup() {
    const memberCount = Math.floor(Math.random() * 3) + 3   // 3–5 members
    const members = uniqueNames(memberCount)
    const defaultPayee = members[0]
    const currencies = ['SGD', 'JPY']
    const currency = 'SGD'

    console.log(`\n📦  Creating test group (${memberCount} members: ${members.join(', ')}) with ${currencies.join(' + ')}\n`)

    const data = await callTRPC('group.create', {
        name: `Tokyo Trip ${Math.floor(Math.random() * 1000)}`,
        currency,
        currencies,
        description: 'Auto-generated for screenshot testing',
        userNames: members,
        defaultPayee,
    })

    if (!data?.id) throw new Error('Failed to create group — is the dev server running?')

    const groupId = data.id
    console.log(`   Group ID: ${groupId}`)

    // Fetch member IDs
    const usersData = await callTRPC('group.getUsers', { groupId }, 'query')
    const users = usersData ?? []
    const userIds = users.map((u) => u.id)

    // Mix of SGD and JPY expenses so balances/summary/history demo multi-currency
    const expenseDefs = [
        { title: 'Airport taxi', amount: 48.0, currency: 'SGD', payerIdx: 0, split: userIds },
        {
            title: 'Hotel night 1',
            amount: 18000,
            currency: 'JPY',
            payerIdx: 1,
            split: userIds.slice(0, Math.max(2, userIds.length - 1)),
        },
        { title: 'Dinner at izakaya', amount: 9550, currency: 'JPY', payerIdx: 0, split: userIds },
        {
            title: 'Museum tickets',
            amount: 60.0,
            currency: 'SGD',
            payerIdx: Math.min(2, userIds.length - 1),
            split: userIds.slice(1),
        },
    ]

    for (const exp of expenseDefs) {
        const payerIdx = Math.min(exp.payerIdx, userIds.length - 1)
        await callTRPC('expense.create', {
            groupId,
            paidByUserId: userIds[payerIdx],
            title: exp.title,
            amount: exp.amount,
            currency: exp.currency,
            category: 'General',
            splitUserIds: exp.split.filter((id) => !!id),
        })
        console.log(`   + Expense: ${exp.title} (${exp.currency} ${exp.amount})`)
    }

    // Seed one settlement so the history page demos both event types.
    if (userIds.length >= 2) {
        await callTRPC('expense.settleUp', {
            groupId,
            payerId: userIds[1],
            receiverId: userIds[0],
            lines: [{ currency: 'SGD', amount: 12.5 }],
        })
        console.log(`   ↔ Settlement: ${users[1].name} → ${users[0].name} SGD 12.50`)
    }

    return { groupId, users }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('🚀  Launching Puppeteer…')
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
    })

    try {
        const page = await browser.newPage()
        await page.setViewport(VIEWPORT)

        // ------------------------------------------------------------------
        // 1. Seed test data
        // ------------------------------------------------------------------
        const { groupId } = await seedTestGroup()
        console.log('\n📸  Taking screenshots…\n')

        // ------------------------------------------------------------------
        // 2. Home page
        // ------------------------------------------------------------------
        await page.goto(BASE_URL, { waitUntil: 'networkidle2' })
        await screenshot(page, '01-home')

        // ------------------------------------------------------------------
        // 3. Groups list
        // ------------------------------------------------------------------
        await page.goto(`${BASE_URL}/groups`, { waitUntil: 'networkidle2' })
        await screenshot(page, '02-groups-list')

        // ------------------------------------------------------------------
        // 4. Create group page
        // ------------------------------------------------------------------
        await page.goto(`${BASE_URL}/groups/create`, { waitUntil: 'networkidle2' })
        await screenshot(page, '03-create-group')

        // ------------------------------------------------------------------
        // 5–9. Group tab pages
        // ------------------------------------------------------------------
        const groupTabs = ['summary', 'expenses', 'balances', 'history', 'settings']
        for (let i = 0; i < groupTabs.length; i++) {
            const tab = groupTabs[i]
            await page.goto(`${BASE_URL}/groups/${groupId}/${tab}`, {
                waitUntil: 'networkidle2',
            })
            await waitForNetworkIdle(page)
            // Small settle to let React finish rendering
            await new Promise((r) => setTimeout(r, 600))
            await screenshot(page, `0${4 + i}-group-${tab}`)
        }

        // ------------------------------------------------------------------
        // 10. Create expense page
        // ------------------------------------------------------------------
        await page.goto(
            `${BASE_URL}/groups/${groupId}/expenses/create`,
            { waitUntil: 'networkidle2' }
        )
        await waitForNetworkIdle(page)
        await new Promise((r) => setTimeout(r, 600))
        await screenshot(page, '09-create-expense')

        console.log(`\n✅  All screenshots saved to screenshots/\n`)
    } finally {
        await browser.close()
    }
}

main().catch((err) => {
    console.error('\n❌ ', err.message)
    process.exit(1)
})
