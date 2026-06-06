import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase env vars manquantes: NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies.'
    )
  }
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabase()[prop as keyof SupabaseClient]
  },
})

const BUCKET = 'chat-media'

export type UploadKind = 'image' | 'video' | 'audio' | 'gif' | 'sticker'

export async function uploadMedia(
  file: Blob,
  kind: UploadKind,
  ext: string
): Promise<string> {
  const cleanExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
  const fileName = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${cleanExt}`

  const contentType = file.type || guessContentType(cleanExt)

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Supabase upload error:', error, { fileName, contentType, statusCode: error.statusCode })
    throw new Error(`${error.message} (${error.statusCode || 'no status'})`)
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return pub.publicUrl
}

function guessContentType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  }
  return map[ext] || 'application/octet-stream'
}
