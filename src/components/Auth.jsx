import { useState } from 'react'
import { api } from '../lib/api'
import './Auth.css'

export default function Auth({ onSuccess }) {
  const [mode, setMode]       = useState('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const reset = () => setError('')
  const formatError = (err) => {
    const message = err?.message || 'Something went wrong.'
    if (message === 'Failed to fetch') {
      return 'Could not reach the API. Check VITE_API_URL and confirm the backend deployment is healthy.'
    }
    return message
  }

  const handle = async (e) => {
    e.preventDefault()
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true); reset()
    try {
      const data = mode === 'login'
        ? await api.login(email, password)
        : await api.register(email, password)
      onSuccess({ email: data.email })
    } catch (err) {
      setError(formatError(err))
    }
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
            <button key={m} className={`auth-tab ${mode === m ? 'active' : ''}`} onClick={() => switchMode(m)}>
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handle} className="auth-form">
          <div className="auth-field">
            <label>Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
