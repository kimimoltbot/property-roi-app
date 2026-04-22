'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
    })
  }, [router])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/login` } })

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

    router.replace('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-3">
      <Card className="w-full max-w-md shadow-none">
        <CardContent className="p-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Property ROI</h1>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">Secure sign in</p>

          <Tabs value={mode} onValueChange={(value) => setMode(value as 'signin' | 'signup')}>
            <TabsList className="mb-3">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={onSubmit} className="space-y-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded border border-border bg-muted px-3 py-2 text-sm outline-none ring-accent/40 placeholder:text-muted-foreground focus:ring-1"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded border border-border bg-muted px-3 py-2 text-sm outline-none ring-accent/40 placeholder:text-muted-foreground focus:ring-1"
            />
            {error && <p className="text-xs text-dla-red">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded border border-accent bg-accent py-2 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-60"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
