import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await signUp(
          email,
          password,
          username,
          displayName,
        )

        if (error) {
          setMessage(error.message)
        } else {
          setMessage(
            'Account created. Check your email if confirmation is enabled.',
          )
        }
      } else {
        const { error } = await signIn(email, password)

        if (error) {
          setMessage(error.message)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          🌌
        </div>

        <h1>MusicGalaxy</h1>

        <p>
          Your universe of music.
        </p>

        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Login
          </button>

          <button
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <input
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />

              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Enter MusicGalaxy'
                : 'Create account'}
          </button>
        </form>

        {message && (
          <div className="auth-message">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}