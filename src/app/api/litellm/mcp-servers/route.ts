import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const litellmUrl = process.env.LITELLM_URL ?? 'http://litellm:4000'
  const apiKey = process.env.LITELLM_API_KEY ?? ''
  try {
    const res = await fetch(`${litellmUrl}/mcp/list_tools`, {
      headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    })
    if (!res.ok) throw new Error(`LiteLLM returned ${res.status}`)
    const data = await res.json()
    // Extract unique server names from tool names (format: "servername__toolname")
    const tools: Array<{ name: string }> = data.tools ?? []
    const serverNames = [...new Set(tools.map((t) => t.name.split('__')[0]).filter(Boolean))]
    return NextResponse.json({ servers: serverNames })
  } catch (err) {
    return NextResponse.json({ servers: [], error: String(err) }, { status: 200 })
  }
}
