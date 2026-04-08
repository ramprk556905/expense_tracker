import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const reset = () => { setError(''); setMessage('') }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!supabase) { setError('Supabase is not configured.'); return }
    setLoading(true); reset()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    if (!supabase) { setError('Supabase is not configured.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); reset()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else setMessage('Account created! Check your email to confirm, then log in.')
    setLoading(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    if (!supabase) { setError('Supabase is not configured.'); return }
    setLoading(true); reset()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) setError(error.message)
    else setMessage('Password reset link sent to your email.')
    setLoading(false)
  }

  const switchMode = (m) => { setMode(m); reset(); setPassword('') }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">💰</span>
          <h1 className="auth-logo-text">ExpenseTracker</h1>
          <p className="auth-tagline">Track your expenses, own your finances.</p>
        </div>

        <div className="auth-tabs">
          {['login', 'signup'].map(m => (
            <button
              key={m}
              className={`auth-tab ${mode === m ? 'active' : ''}`}
              onClick={() => switchMode(m)}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {mode === 'forgot' ? (
          <form onSubmit={handleForgot} className="auth-form">
            <p className="auth-hint">Enter your email and we'll send a reset link.</p>
            <div className="auth-field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-success">{message}</div>}
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <button type="button" className="auth-link" onClick={() => switchMode('login')}>
              ← Back to Log In
            </button>
          </form>
        ) : (
          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="auth-form">
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-success">{message}</div>}
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
            {mode === 'login' && (
              <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
