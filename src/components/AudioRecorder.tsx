'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { uploadMedia } from '@/lib/supabase'

interface AudioRecorderProps {
  onSend: (data: { url: string; duration: number }) => void
  onClose: () => void
}

export default function AudioRecorder({ onSend, onClose }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [uploading, setUploading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      stopStream()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: getSupportedMime() })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = handleStop
      recorder.start()
      setRecording(true)
      startTimeRef.current = Date.now()
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 100)
    } catch (e) {
      console.error(e)
      alert("Impossible d'accéder au micro")
    }
  }

  function getSupportedMime() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t
    }
    return ''
  }

  async function handleStop() {
    stopStream()
    if (timerRef.current) clearInterval(timerRef.current)
    const mime = getSupportedMime()
    const blob = new Blob(chunksRef.current, { type: mime })
    const ext = mime.includes('mp4') ? 'mp4' : 'webm'
    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000)
    setUploading(true)
    try {
      const url = await uploadMedia(blob, 'audio', ext)
      onSend({ url, duration: finalDuration })
    } catch (e) {
      console.error(e)
      alert("Échec de l'envoi du vocal")
    } finally {
      setUploading(false)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  function cancel() {
    if (recording) {
      mediaRecorderRef.current?.stop()
    }
    stopStream()
    if (timerRef.current) clearInterval(timerRef.current)
    onClose()
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="absolute bottom-14 left-0 right-0 rounded-2xl border border-white/[0.08] bg-[#0e0e14] backdrop-blur-xl shadow-2xl px-4 py-3 z-50 flex items-center gap-3">
      {uploading ? (
        <>
          <Loader2 className="h-4 w-4 text-white/60 animate-spin" />
          <span className="text-sm text-white/70">Envoi en cours...</span>
        </>
      ) : recording ? (
        <>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-white/80 font-mono">{formatTime(duration)}</span>
          <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-red-500/70 transition-all"
              style={{ width: `${Math.min((duration / 120) * 100, 100)}%` }}
            />
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 text-xs"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Arrêter
          </button>
          <button
            onClick={cancel}
            className="h-9 px-3 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.05] text-xs"
          >
            Annuler
          </button>
        </>
      ) : (
        <>
          <Mic className="h-4 w-4 text-white/60" />
          <span className="text-sm text-white/70">Message vocal</span>
          <div className="flex-1" />
          <button
            onClick={startRecording}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs"
          >
            <Mic className="h-3.5 w-3.5" />
            Démarrer
          </button>
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.05] text-xs"
          >
            Fermer
          </button>
        </>
      )}
    </div>
  )
}
