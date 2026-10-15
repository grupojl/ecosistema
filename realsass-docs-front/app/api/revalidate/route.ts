import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

/**
 * Webhook inbound de superadmin (REST permitido: sistema externo, ver CLAUDE.md).
 * Al publicar, despublicar, eliminar o editar una página publicada, superadmin llama:
 *   POST /api/revalidate   x-internal-api-key: …   { "tag": "docs:<ecosistema>" }
 */
const TAG_PATTERN = /^docs:[a-z0-9-]{1,64}$/

function sameKey(received: string | null, expected: string): boolean {
  if (!received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const expected = process.env.INTERNAL_API_KEY
  if (!expected) {
    console.error('[docs] /api/revalidate sin INTERNAL_API_KEY configurada')
    return NextResponse.json({ error: 'not configured' }, { status: 500 })
  }
  if (!sameKey(request.headers.get('x-internal-api-key'), expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  const tag = typeof body === 'object' && body !== null && 'tag' in body ? (body as { tag: unknown }).tag : null
  if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) {
    return NextResponse.json({ error: 'invalid tag' }, { status: 400 })
  }

  // expire: 0 → expira ya mismo (webhook): el próximo lector ve lo recién publicado, sin servir una copia vieja.
  revalidateTag(tag, { expire: 0 })
  return NextResponse.json({ revalidated: true, tag })
}
