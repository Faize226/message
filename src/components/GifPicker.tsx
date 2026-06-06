'use client'

import { useEffect, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { GIPHY_KEY } from '@/lib/giphy'

interface Gif {
  id: string
  title: string
  url: string
  width: string
  height: string
}

interface GifPickerProps {
  onSelect: (gif: { url: string }) => void
  onClose: () => void
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const endpoint = query
          ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=pg-13`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`
        const res = await fetch(endpoint)
        const data = await res.json()
        if (cancelled) return
        setGifs(
          (data.data || []).map((g: { id: string; title: string; images: { fixed_height: { url: string; width: string; height: string } } }) => ({
            id: g.id,
            title: g.title,
            url: g.images.fixed_height.url,
            width: g.images.fixed_height.width,
            height: g.images.fixed_height.height,
          })).filter((g: Gif) => g.url)
        )
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const t = setTimeout(load, query ? 400 : 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  return (
    <div className="absolute bottom-14 left-0 w-80 max-h-96 rounded-2xl border border-white/[0.08] bg-[#0e0e14] backdrop-blur-xl shadow-2xl p-3 z-50 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un GIF..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/30 outline-none focus:bg-white/[0.08]"
          />
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
        {loading && gifs.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 text-white/30 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => {
                  console.log('GIF selected:', gif.url)
                  onSelect(gif)
                }}
                className="rounded-lg overflow-hidden bg-white/[0.04] hover:ring-2 hover:ring-white/30 transition-all"
              >
                <img src={gif.url} alt={gif.title} className="w-full h-24 object-cover" loading="lazy" />
              </button>
            ))}
            {!loading && gifs.length === 0 && (
              <p className="col-span-2 text-center text-xs text-white/30 py-4">Aucun résultat</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
