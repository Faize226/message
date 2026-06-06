'use client'

import { useState } from 'react'

const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
  '🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚',
  '😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸',
  '🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️',
  '😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡',
  '🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓',
  '🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄',
  '😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵',
  '🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠',
  '😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
  '✨','💫','💥','💯','💢','💨','💦','💤','🔥','⭐',
  '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙',
  '👈','👉','👆','🖕','👇','☝️','👋','🤚','🖐️','✋',
  '🙌','👏','🤝','🙏','✍️','💪','🦾','🦿','🦵','🦶',
]

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [query, setQuery] = useState('')

  const filtered = query
    ? EMOJIS.filter((e) => e.includes(query))
    : EMOJIS

  return (
    <div className="absolute bottom-14 left-0 w-80 max-h-80 rounded-2xl border border-white/[0.08] bg-[#0e0e14] backdrop-blur-xl shadow-2xl p-3 z-50 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un émoji..."
          className="flex-1 h-8 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/30 outline-none focus:bg-white/[0.08]"
        />
        <button
          onClick={onClose}
          className="ml-2 w-8 h-8 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1 overflow-y-auto pr-1">
        {filtered.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 rounded-lg text-xl hover:bg-white/[0.08] transition-colors flex items-center justify-center"
          >
            {emoji}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-8 text-center text-xs text-white/30 py-4">Aucun émoji</p>
        )}
      </div>
    </div>
  )
}
