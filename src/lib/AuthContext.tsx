import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<{ error: Error | null }>
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
)

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return

      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setLoading(false)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signUp(
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) {
    if (!supabase) {
      return {
        error: new Error(
          'Supabase is not configured. Check .env.local.',
        ),
      }
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
        },
      },
    })

    return { error }
  }

  async function signIn(
    email: string,
    password: string,
  ) {
    if (!supabase) {
      return {
        error: new Error(
          'Supabase is not configured. Check .env.local.',
        ),
      }
    }

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    return { error }
  }

  async function signOut() {
    if (!supabase) {
      return {
        error: new Error(
          'Supabase is not configured. Check .env.local.',
        ),
      }
    }

    const { error } = await supabase.auth.signOut()

    return { error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    )
  }

  return context
}