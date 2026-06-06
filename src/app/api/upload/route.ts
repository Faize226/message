import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { auth } from '@/lib/auth'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 50 * 1024 * 1024
const ALLOWED_KINDS = ['image', 'video', 'audio']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const kind = (form.get('kind') as string) || 'image'

  if (!file) {
    return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 50 Mo)' }, { status: 413 })
  }

  if (!ALLOWED_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Type non supporté' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || '').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const dir = path.join(UPLOAD_DIR, kind)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const filePath = path.join(dir, baseName)
  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, bytes)

  return NextResponse.json({ url: `/uploads/${kind}/${baseName}` })
}
