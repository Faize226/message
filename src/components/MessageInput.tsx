'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { Send, Smile, Image as ImageIcon, Video, Mic, FileImage, Paperclip, Loader2, X, Reply, Pencil } from 'lucide-react'
import EmojiPicker from './EmojiPicker'
import GifPicker from './GifPicker'
import StickerPicker from './StickerPicker'
import AudioRecorder from './AudioRecorder'
import { uploadMedia } from '@/lib/supabase'

type PickerKind = null | 'emoji' | 'gif' | 'sticker' | 'audio'

export interface SendData {
  type: 'text' | 'image' | 'video' | 'audio' | 'gif' | 'sticker'
  content: string | null
  url: string | null
  duration: number | null
}

interface ReplyRef {
  id: string
  content: string | null
  type: string
  user: { name: string | null; username: string | null }
}

interface MessageInputProps {
  onSend: (data: SendData, replyToId: string | null) => void
  onSubmitEdit?: (content: string) => void
  replyTo?: ReplyRef | null
  editingMessage?: ReplyRef & { content: string } | null
  onCancel?: () => void
}

const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp,image/gif'
const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime'
const MAX_FILE_SIZE = 50 * 1024 * 1024

function getReplyPreviewText(replyTo: ReplyRef): string {
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

export default function MessageInput({ onSend, onSubmitEdit, replyTo, editingMessage, onCancel }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [picker, setPicker] = useState<PickerKind>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const isEditMode = !!editingMessage

  useEffect(() => {
    // Sync local input value when entering/exiting edit mode (prop change from parent).
    if (editingMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(editingMessage.content)
      // Focus après un tick pour laisser React appliquer la valeur
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(editingMessage.content.length, editingMessage.content.length)
      })
    } else {
      setValue('')
    }
    setPicker(null)
  }, [editingMessage])

  function closePicker() { setPicker(null) }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!value.trim()) return
    if (isEditMode && onSubmitEdit) {
      onSubmitEdit(value.trim())
    } else {
      onSend({ type: 'text', content: value.trim(), url: null, duration: null }, replyTo?.id ?? null)
    }
    setValue('')
    if (!isEditMode) {
      inputRef.current?.focus()
    }
  }

  function insertEmoji(emoji: string) {
    setValue((v) => v + emoji)
    inputRef.current?.focus()
  }

  async function handleFile(file: File, kind: 'image' | 'video') {
    if (file.size > MAX_FILE_SIZE) {
      alert('Fichier trop volumineux (max 50 Mo)')
      return
    }
    setUploading(true)
    setUploadLabel(kind === 'image' ? 'Image' : 'Vidéo')
    setUploadError(null)
    try {
      const ext = file.name.split('.').pop() || (kind === 'image' ? 'jpg' : 'mp4')
      const url = await uploadMedia(file, kind, ext)
      onSend({ type: kind, content: null, url, duration: null }, replyTo?.id ?? null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      console.error('Upload failed:', e)
      setUploadError(msg)
    } finally {
      setUploading(false)
      setUploadLabel('')
    }
  }

  function handleCancel() {
    setValue('')
    setPicker(null)
    onCancel?.()
  }

  return (
    <div className="relative border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-3 py-2.5 shrink-0">
      {uploading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070a]/80 backdrop-blur-sm rounded">
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Envoi {uploadLabel.toLowerCase()} en cours...
            <button onClick={() => setUploading(false)} className="ml-2 text-white/40 hover:text-white/70">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="absolute -top-12 left-3 right-3 z-30 flex items-center gap-2 rounded-lg bg-red-500/15 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          <span className="flex-1 truncate">Échec : {uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-red-300/60 hover:text-red-300">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {(replyTo || editingMessage) && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-white/[0.04] border-l-2 border-white/20">
          {isEditMode ? (
            <Pencil className="h-3.5 w-3.5 text-white/50 shrink-0" />
          ) : (
            <Reply className="h-3.5 w-3.5 text-white/50 shrink-0" />
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="text-[11px] font-semibold text-white/70">
              {isEditMode ? 'Modification du message' : `Réponse à ${replyTo?.user.name || replyTo?.user.username || 'Utilisateur'}`}
            </span>
            {!isEditMode && replyTo && (
              <span className="text-[12px] text-white/50 truncate">
                {getReplyPreviewText(replyTo)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="shrink-0 p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/[0.06]"
            title="Annuler"
            aria-label="Annuler"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {picker === 'emoji' && <EmojiPicker onSelect={insertEmoji} onClose={closePicker} />}
      {picker === 'gif' && !isEditMode && <GifPicker onSelect={(g) => { onSend({ type: 'gif', content: null, url: g.url, duration: null }, replyTo?.id ?? null); closePicker() }} onClose={closePicker} />}
      {picker === 'sticker' && !isEditMode && <StickerPicker onSelect={(s) => { onSend({ type: 'sticker', content: null, url: s.url, duration: null }, replyTo?.id ?? null); closePicker() }} onClose={closePicker} />}
      {picker === 'audio' && !isEditMode && <AudioRecorder onSend={(d) => { onSend({ type: 'audio', content: null, url: d.url, duration: d.duration }, replyTo?.id ?? null); closePicker() }} onClose={closePicker} />}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <ToolbarButton active={picker === 'emoji'} onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')} label="Émojis" disabled={isEditMode}><Smile className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton active={picker === 'gif'} onClick={() => setPicker(picker === 'gif' ? null : 'gif')} label="GIFs" disabled={isEditMode}><FileImage className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton active={picker === 'sticker'} onClick={() => setPicker(picker === 'sticker' ? null : 'sticker')} label="Stickers" disabled={isEditMode}><Paperclip className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => imageInputRef.current?.click()} label="Image" disabled={isEditMode}><ImageIcon className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => videoInputRef.current?.click()} label="Vidéo" disabled={isEditMode}><Video className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton active={picker === 'audio'} onClick={() => setPicker(picker === 'audio' ? null : 'audio')} label="Vocal" disabled={isEditMode}><Mic className="h-4 w-4" /></ToolbarButton>

        <input
          ref={value || isEditMode ? undefined : inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && (isEditMode || replyTo) && onCancel) {
              e.preventDefault()
              handleCancel()
            }
          }}
          autoComplete="off"
          placeholder={isEditMode ? 'Modifier le message...' : replyTo ? 'Répondre...' : 'Écrire un message...'}
          className="flex-1 h-9 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:bg-white/[0.06] focus:border-white/[0.15]"
        />

        <button
          type="submit"
          disabled={!value.trim()}
          className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 transition-all duration-200 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
          title={isEditMode ? 'Modifier' : 'Envoyer'}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      <input
        ref={imageInputRef}
        type="file"
        accept={ACCEPT_IMAGE}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f, 'image')
          e.target.value = ''
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={ACCEPT_VIDEO}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f, 'video')
          e.target.value = ''
        }}
      />
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  active,
  label,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`shrink-0 flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-200 ${
        disabled
          ? 'opacity-30 cursor-not-allowed text-white/30'
          : active
            ? 'bg-white/15 text-white/80'
            : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  )
}
