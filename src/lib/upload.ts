const API_URL = '/api/upload'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export type UploadKind = 'image' | 'video' | 'audio'

export async function uploadMedia(
  file: Blob,
  kind: UploadKind,
  fileName?: string
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Fichier trop volumineux (max 50 Mo)')
  }

  const form = new FormData()
  form.append('file', file, fileName || `upload.${kind}`)
  form.append('kind', kind)

  const res = await fetch(API_URL, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.url as string
}
