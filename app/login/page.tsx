'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      setError('Account created. If email confirmation is enabled, please verify then sign in.')
      setLoading(false)
      return
    }

    router.replace('/')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900">Property ROI</h1>
        <p className="text-sm text-gray-500 mt-1 mb-4">Secure sign in</p>

        <div className="grid grid-cols-2 bg-gray-100 rounded-lg p-1 mb-4">
          <button onClick={() => setMode('signin')} className={`rounded-md py-2 text-sm ${mode === 'signin' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>Sign in</button>
          <button onClick={() => setMode('signup')} className={`rounded-md py-2 text-sm ${mode === 'signup' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>Create</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2 font-medium">
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
