'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function AuthForm() {
  const router = useRouter()
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const form = new FormData(e.currentTarget)
    const username = form.get('username') as string
    const password = form.get('password') as string

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Nom d\'utilisateur ou mot de passe incorrect')
    } else {
      router.push('/chat')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-[#f1f5f9] text-center">Connexion</h1>
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
      <input
        name="username"
        type="text"
        placeholder="Nom d'utilisateur"
        required
        className="w-full px-4 py-3 rounded-lg bg-[#1a1a2e] text-[#f1f5f9] border border-[#2a2a4a] focus:outline-none focus:border-[#3b82f6] placeholder-[#94a3b8]"
      />
      <input
        name="password"
        type="password"
        placeholder="Mot de passe"
        required
        className="w-full px-4 py-3 rounded-lg bg-[#1a1a2e] text-[#f1f5f9] border border-[#2a2a4a] focus:outline-none focus:border-[#3b82f6] placeholder-[#94a3b8]"
      />
      <button
        type="submit"
        className="w-full py-3 rounded-lg bg-[#3b82f6] text-white font-medium hover:bg-[#2563eb] transition-colors"
      >
        Se connecter
      </button>
    </form>
  )
}
