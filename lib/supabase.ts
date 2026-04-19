import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const fallbackUrl = 'https://ionmxuflxfesfxpdzcvr.supabase.co'
const fallbackAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlvbm14dWZseGZlc2Z4cGR6Y3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjQ2NDIsImV4cCI6MjA4NTM0MDY0Mn0.zu6ikBIq6jF9xkGGgoBVx6YcK3rdJqO5FcfYNxB6dQc'

export const supabase = createClient(supabaseUrl || fallbackUrl, supabaseAnonKey || fallbackAnonKey)
