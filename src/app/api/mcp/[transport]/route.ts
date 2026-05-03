import { createMcpHandler } from '@vercel/mcp-adapter'
import { z } from 'zod'

import { checkMcpAuth } from '~/server/mcp/auth'
import { mcpTools } from '~/server/mcp/tools'

const handler = createMcpHandler(
    (server) => {
        for (const [name, def] of Object.entries(mcpTools)) {
            server.tool(
                name,
                def.description,
                def.inputSchema as Record<string, z.ZodTypeAny>,
                async (input: unknown) => {
                    // The MCP SDK validates input against inputSchema before invoking this
                    // callback, so the cast is sound — input has already been parsed and
                    // matches the handler's parameter type. Cast as any to let handler's
                    // actual parameter type prevail.
                    const result = await def.handler(input as any)
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                    }
                }
            )
        }
    },
    {},
    { basePath: '/api/mcp' }
)

async function withAuth(req: Request): Promise<Response> {
    const authError = checkMcpAuth(req)
    if (authError) return authError
    return handler(req)
}

export { withAuth as GET, withAuth as POST }
