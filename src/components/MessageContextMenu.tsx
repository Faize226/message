'use client'

import { useEffect, useRef, useState } from 'react'
import { Reply, Pencil, Trash2 } from 'lucide-react'

interface MessageContextMenuProps {
  x: number
  y: number
  isMine: boolean
  type: string
  onReply: () => void
  onEdit?: () => void
  onDelete?: () => void
  onClose: () => void
}

export default function MessageContextMenu({
  x,
  y,
  isMine,
  type,
  onReply,
  onEdit,
  onDelete,
  onClose,
}: MessageContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x, y })

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const padding = 8
    let nx = x
    let ny = y
    if (x + rect.width + padding > window.innerWidth) {
      nx = Math.max(padding, window.innerWidth - rect.width - padding)
    }
    if (y + rect.height + padding > window.innerHeight) {
      ny = Math.max(padding, window.innerHeight - rect.height - padding)
    }
    setAdjustedPos({ x: nx, y: ny })
  }, [x, y])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleTouchOutside(e: TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleScroll() {
      onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleTouchOutside)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleTouchOutside)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-xl border border-white/[0.08] bg-[#0e0e14] shadow-2xl py-1"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={() => { onReply(); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
      >
        <Reply className="h-3.5 w-3.5" />
        Répondre
      </button>
      {isMine && type === 'text' && onEdit && (
        <button
          onClick={() => { onEdit(); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </button>
      )}
      {isMine && onDelete && (
        <button
          onClick={() => { onDelete(); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer
        </button>
      )}
    </div>
  )
}
