import { writeFileSync } from 'fs'
import path from 'path'
import { trpcMutation, trpcQuery } from './helpers/trpc'

const STATE_FILE = path.join(process.cwd(), '.playwright-state.json')

export default async function globalSetup() {
  console.log('[globalSetup] Seeding test group...')

  const group = await trpcMutation<{ id: string }>('group.create', {
    name: 'Playwright Test Group',
    currency: 'USD',
    description: 'Auto-created by Playwright globalSetup',
    userNames: ['Alice', 'Bob', 'Charlie'],
    defaultPayee: 'Alice',
  })

  if (!group.id) {
    throw new Error('[globalSetup] group.create returned no id — is the dev server running?')
  }

  const users = await trpcQuery<Array<{ id: string; name: string }>>('group.getUsers', {
    groupId: group.id,
  })

  writeFileSync(STATE_FILE, JSON.stringify({ groupId: group.id, users }), 'utf-8')
  console.log(`[globalSetup] Created group ${group.id} with ${users.length} members`)
}
