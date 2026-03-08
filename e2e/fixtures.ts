import { test as base } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'

interface TestFixtures {
  groupId: string
  userIds: string[]
}

const STATE_FILE = path.join(process.cwd(), '.playwright-state.json')

export const test = base.extend<TestFixtures>({
  groupId: async ({}, use) => {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as {
      groupId: string
      users: Array<{ id: string; name: string }>
    }
    await use(state.groupId)
  },
  userIds: async ({}, use) => {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as {
      groupId: string
      users: Array<{ id: string; name: string }>
    }
    await use(state.users.map((u) => u.id))
  },
})

export { expect } from '@playwright/test'
