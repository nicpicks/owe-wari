const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// tRPC v10 + superjson transformer + httpBatchStreamLink wire format
// mutations → POST /api/trpc/<proc>?batch=1  body: {"0":{"json":<input>}}
// queries   → GET  /api/trpc/<proc>?batch=1&input={"0":{"json":<input>}}
// response: [{"result":{"data":{"json":<output>}}}]

export async function trpcMutation<T>(procedure: string, input: unknown): Promise<T> {
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
  const json = (await res.json()) as Array<{ result: { data: { json: T } } }>
  const result = json[0]?.result?.data?.json
  if (result === undefined) throw new Error(`Empty result from ${procedure}`)
  return result
}

export async function trpcQuery<T>(procedure: string, input: unknown): Promise<T> {
  const encoded = encodeURIComponent(JSON.stringify({ '0': { json: input } }))
  const url = `${BASE_URL}/api/trpc/${procedure}?batch=1&input=${encoded}`
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`tRPC ${procedure} failed (${res.status}): ${text}`)
  }
  const json = (await res.json()) as Array<{ result: { data: { json: T } } }>
  const result = json[0]?.result?.data?.json
  if (result === undefined) throw new Error(`Empty result from ${procedure}`)
  return result
}
