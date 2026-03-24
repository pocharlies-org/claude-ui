import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { encryptCredentials } from '@/lib/crypto'
import { validateCredentialsJson } from '@/lib/credential-schema'
import { db } from '@/lib/db'

/**
 * GET /api/user/credentials — returns credential status (never the credential itself)
 */
export async function GET() {
  let user
  try { user = await requireAuth() } catch (res) { return res as Response }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { credentialsLinkedAt: true },
  })

  return NextResponse.json({
    linked: !!dbUser?.credentialsLinkedAt,
    linkedAt: dbUser?.credentialsLinkedAt?.toISOString() ?? null,
  })
}

/**
 * POST /api/user/credentials — upload and encrypt a credentials.json file
 * Accepts either multipart/form-data (file upload) or JSON body with { credentials: "..." }
 */
export async function POST(req: NextRequest) {
  let user
  try { user = await requireAuth() } catch (res) { return res as Response }

  let raw: string

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    const file = formData.get('credentials')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing credentials file' }, { status: 400 })
    }
    raw = await (file as Blob).text()
  } else {
    const body = await req.json().catch(() => null)
    if (!body?.credentials || typeof body.credentials !== 'string') {
      return NextResponse.json({ error: 'Missing credentials field' }, { status: 400 })
    }
    raw = body.credentials
  }

  const validation = validateCredentialsJson(raw)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const encrypted = encryptCredentials(raw)
  const now = new Date()

  await db.user.update({
    where: { id: user.id },
    data: { encryptedCredentials: encrypted, credentialsLinkedAt: now },
  })

  return NextResponse.json({ success: true, linkedAt: now.toISOString() })
}

/**
 * DELETE /api/user/credentials — unlink (remove) stored credentials
 */
export async function DELETE() {
  let user
  try { user = await requireAuth() } catch (res) { return res as Response }

  await db.user.update({
    where: { id: user.id },
    data: { encryptedCredentials: null, credentialsLinkedAt: null },
  })

  return NextResponse.json({ success: true })
}
