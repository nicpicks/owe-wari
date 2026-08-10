// Wire format for httpBatchStreamLink (tRPC v11 + superjson), 2-line JSONL:
//   Line 1 (head):  {"json":{"0":[[0],[null,0,0]]}}   — promise placeholder [chunkId=0]
//   Line 2 (chunk): {"json":[0,0,[[<result>]]]}        — promise fulfilled [chunkId, STATUS_FULFILLED, dehydrated]
// The head "0":[[placeholder],[null, CHUNK_TYPE_PROMISE=0, chunkId=0]] signals a pending promise.
// The chunk [0, 0(fulfilled), [[data]]] resolves that promise with data.
const HEAD_LINE = JSON.stringify({ json: { '0': [[0], [null, 0, 0]] } }) + '\n'

/** A fulfilled single-procedure response carrying `data`. */
export function mockStreamedResult(data: unknown): string {
  return HEAD_LINE + JSON.stringify({ json: [0, 0, [[{ result: { data } }]]] }) + '\n'
}

/** A rejected single-procedure response. */
export function mockStreamedError(message = 'Internal server error'): string {
  const error = {
    message,
    code: -32603,
    data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
  }
  return HEAD_LINE + JSON.stringify({ json: [0, 0, [[{ error }]]] }) + '\n'
}

export interface ScanResult {
  total: number | null
  items?: { name: string; amount: number }[]
  category?: string | null
}

/** A `receipt.scan` success payload in the shape the form expects. */
export function mockScanSuccess({ total, items = [], category = null }: ScanResult): string {
  return mockStreamedResult({ total, items, category })
}
