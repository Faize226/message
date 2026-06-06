'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Download, Trash2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import MessageContextMenu from './MessageContextMenu'

interface ReplyRef {
  id: string
  content: string | null
  type: string
  user: { name: string | null; username: string | null }
}

interface MessageBubbleProps {
  id: string
  content: string | null
  type: string
  url: string | null
  duration: number | null
  isMine: boolean
  time: string
  isConsecutive?: boolean
  replyTo: ReplyRef | null
  editedAt: string | null
  onDelete?: (id: string) => void
  onReply?: (id: string) => void
  onEdit?: (id: string) => void
  onScrollToMessage?: (id: string) => void
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function MessageBubble({
  id,
  content,
  type,
  url,
  duration,
  isMine,
  time,
  isConsecutive,
  replyTo,
  editedAt,
  onDelete,
  onReply,
  onEdit,
  onScrollToMessage,
}: MessageBubbleProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const touchMoved = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    }
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStartPos.current = { x: t.clientX, y: t.clientY }
    touchMoved.current = false
    longPressTimer.current = window.setTimeout(() => {
      if (touchStartPos.current && !touchMoved.current) {
        setContextMenu({ x: touchStartPos.current.x, y: touchStartPos.current.y })
      }
      longPressTimer.current = null
    }, 500)
  }

  function handleTouchMove() {
    touchMoved.current = true
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  function handleDelete() {
    setContextMenu(null)
    setConfirmOpen(true)
  }

  function confirmDelete() {
    setConfirmOpen(false)
    onDelete?.(id)
  }

  function getReplyPreview(): string {
    if (!replyTo) return ''
    const PREVIEW_BY_TYPE: Record<string, string> = {
      image: '📷 Image',
      video: '🎥 Vidéo',
      audio: '🎤 Message vocal',
      gif: '🎬 GIF',
      sticker: '😀 Sticker',
    }
    if (replyTo.type !== 'text') return PREVIEW_BY_TYPE[replyTo.type] || 'Message'
    const text = (replyTo.content || '').trim()
    if (text.length === 0) return 'Message vide'
    return text.length > 80 ? text.slice(0, 80) + '…' : text
  }

  return (
    <div
      ref={containerRef}
      className={`group flex items-start gap-1.5 ${isMine ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-0.5' : 'mt-2'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer ce message ?"
        message="Cette action est irréversible. Le message disparaîtra pour les deux participants."
        confirmText="Supprimer"
        cancelText="Annuler"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isMine={isMine}
          type={type}
          onReply={() => onReply?.(id)}
          onEdit={onEdit ? () => onEdit(id) : undefined}
          onDelete={onDelete ? handleDelete : undefined}
          onClose={() => setContextMenu(null)}
        />
      )}
      {isMine && onDelete && (
        <div className="pt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={handleContextMenu}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.05]"
            title="Plus d'actions"
            aria-label="Plus d'actions"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div
        className={`max-w-[75%] ${
          isMine
            ? 'bg-white/10 text-white/90 rounded-2xl rounded-br-md'
            : 'bg-white/[0.04] text-white/80 rounded-2xl rounded-bl-md'
        } overflow-hidden`}
      >
        {replyTo && (
          <button
            type="button"
            onClick={() => onScrollToMessage?.(replyTo.id)}
            className={`w-full text-left flex flex-col gap-0.5 px-4 pt-2 pb-1.5 border-l-2 ${
              isMine ? 'border-white/30 bg-white/[0.04]' : 'border-white/20 bg-white/[0.02]'
            } hover:bg-white/[0.06] transition-colors`}
          >
            <span className={`text-[11px] font-semibold ${isMine ? 'text-white/70' : 'text-white/60'}`}>
              {replyTo.user.name || replyTo.user.username || 'Utilisateur'}
            </span>
            <span className={`text-[12px] truncate ${isMine ? 'text-white/55' : 'text-white/45'}`}>
              {getReplyPreview()}
            </span>
          </button>
        )}
        {type === 'image' && url && <ImageContent url={url} />}
        {type === 'video' && url && <VideoContent url={url} />}
        {type === 'gif' && url && (
          <img src={url} alt="gif" className="max-w-full max-h-72 object-cover" loading="lazy" />
        )}
        {type === 'sticker' && url && <StickerContent url={url} />}
        {type === 'audio' && url && <AudioContent url={url} duration={duration || 0} isMine={isMine} />}

        {content && type === 'text' && (
          <div className="px-4 py-2.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          </div>
        )}

        {content && type !== 'text' && (
          <div className="px-4 py-2.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          </div>
        )}

        {type !== 'sticker' && (
          <div className="px-4 pb-2 flex items-center gap-1">
            <p className={`text-[10px] ${isMine ? 'text-white/30' : 'text-white/20'}`}>{time}</p>
            {editedAt && (
              <p className={`text-[10px] ${isMine ? 'text-white/30' : 'text-white/20'}`}>· modifié</p>
            )}
          </div>
        )}
        {type === 'sticker' && (
          <div className={`px-4 pb-1 flex items-center gap-1 ${isMine ? 'text-right' : 'text-left'}`}>
            <p className={`text-[10px] ${isMine ? 'text-white/30' : 'text-white/20'}`}>{time}</p>
            {editedAt && (
              <p className={`text-[10px] ${isMine ? 'text-white/30' : 'text-white/20'}`}>· modifié</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ImageContent({ url }: { url: string }) {
  return (
    <div className="bg-black/30">
      <img src={url} alt="image" className="max-w-full max-h-80 object-cover" loading="lazy" />
    </div>
  )
}

function VideoContent({ url }: { url: string }) {
  return (
    <video src={url} controls playsInline className="max-w-full max-h-80" />
  )
}

function StickerContent({ url }: { url: string }) {
  const [errored, setErrored] = useState(false)
  return (
    <div className="p-1">
      {errored ? (
        <div className="w-32 h-32 flex items-center justify-center rounded-lg bg-white/[0.04] text-3xl" title="Sticker indisponible">
          🎭
        </div>
      ) : (
        <img
          src={url}
          alt="sticker"
          className="w-32 h-32 object-contain"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  )
}

function AudioContent({ url, duration, isMine }: { url: string; duration: number; isMine: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 min-w-[220px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => { setPlaying(false); setCurrent(0) }}
      />
      <button
        onClick={() => {
          if (!audioRef.current) return
          if (playing) audioRef.current.pause()
          else audioRef.current.play()
        }}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          isMine ? 'bg-white/15 hover:bg-white/25' : 'bg-white/[0.08] hover:bg-white/[0.15]'
        }`}
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className={`h-full transition-all ${isMine ? 'bg-white/30' : 'bg-white/20'}`}
            style={{ width: `${duration > 0 ? Math.min((current / duration) * 100, 100) : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px]">
          <span className={isMine ? 'text-white/40' : 'text-white/30'}>{formatDuration(Math.floor(current))}</span>
          <span className={isMine ? 'text-white/40' : 'text-white/30'}>{formatDuration(duration)}</span>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isMine ? 'text-white/40 hover:text-white/60' : 'text-white/30 hover:text-white/50'}`}
      >
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
