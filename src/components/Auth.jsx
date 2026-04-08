import { useState } from 'react'
import { api } from '../lib/api'
import './Auth.css'

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M3.3 2.3a1 1 0 0 0-1.4 1.4l2.1 2.1A12.5 12.5 0 0 0 1 12s3.5 7 11 7a11 11 0 0 0 5.1-1.2l2.6 2.6a1 1 0 1 0 1.4-1.4L3.3 2.3ZM8.2 10.9l4.9 4.9a3.5 3.5 0 0 1-4.9-4.9Zm7.4 2.9-1.8-1.8a3.5 3.5 0 0 0-3.8-3.8L8.2 6.4A9.7 9.7 0 0 1 12 5c7.5 0 11 7 11 7a12.8 12.8 0 0 1-2.6 3.6l-1.5-1.5a10.5 10.5 0 0 0 1.6-2.1A10.3 10.3 0 0 0 12 7a7.8 7.8 0 0 0-2.2.3l1.8 1.8a3.5 3.5 0 0 1 4 4.7Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 5C4.5 5 1 12 1 12s3.5 7 11 7 11-7 11-7-3.5-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Auth({ onSuccess }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetExpiresAt, setResetExpiresAt] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const resetMessages = () => {
    setError('')
    setNotice('')
  }

  const resetPasswordFields = () => {
    setPassword('')
    setResetCode('')
    setResetExpiresAt('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    resetMessages()
    resetPasswordFields()
    setShowPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const formatError = (err) => {
    const message = err?.message || 'Something went wrong.'
    if (message === 'Failed to fetch') {
      return 'Could not reach the API. Check VITE_API_URL and confirm the backend deployment is healthy.'
    }
    return message
  }

  const handleAuth = async (event) => {
    event.preventDefault()
    resetMessages()

    if ((mode === 'signup' || mode === 'login') && !email.trim()) {
      setError('Email is required.')
      return
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const data = mode === 'login'
        ? await api.login(email, password, rememberMe)
        : await api.register(email, password, rememberMe)
      onSuccess({
        email: data.email,
        rememberMe: data.remember_me,
        emailVerified: data.email_verified,
        notifyNewTransaction: data.notify_new_transaction,
      })
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (event) => {
    event.preventDefault()
    resetMessages()
    if (!email.trim()) {
      setError('Enter your email to request a reset code.')
      return
    }

    setLoading(true)
    try {
      const data = await api.forgotPassword(email)
      setNotice(data.message)
      setResetCode(data.reset_code || '')
      setResetExpiresAt(data.expires_at || '')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    resetMessages()
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!resetCode.trim()) {
      setError('Enter the reset code.')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await api.resetPassword(email, resetCode, newPassword)
      setNotice('Password updated. You can log in with the new password now.')
      setMode('login')
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setResetCode('')
      setResetExpiresAt('')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  const resetExpiryLabel = resetExpiresAt
    ? new Date(resetExpiresAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : ''

  const isForgotMode = mode === 'forgot'

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">💰</span>
          <h1 className="auth-logo-text">ExpenseTracker</h1>
          <p className="auth-tagline">Track your expenses, own your finances.</p>
        </div>

        <div className="auth-tabs">
          {['login', 'signup'].map((tab) => (
            <button
              key={tab}
              className={`auth-tab ${mode === tab ? 'active' : ''}`}
              onClick={() => switchMode(tab)}
              type="button"
            >
              {tab === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {!isForgotMode ? (
          <form onSubmit={handleAuth} className="auth-form">
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="auth-password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </div>
            </div>

            <label className="auth-checkbox-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember me on this device</span>
            </label>

            {error && <div className="auth-error">{error}</div>}
            {notice && <div className="auth-success">{notice}</div>}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>

            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <div className="auth-form">
            <form onSubmit={handleForgotPassword} className="auth-form">
              <div className="auth-field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && <div className="auth-error">{error}</div>}
              {notice && <div className="auth-success">{notice}</div>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Generating code...' : 'Get Reset Code'}
              </button>
            </form>

            <div className="auth-reset-panel">
              <p className="auth-hint">
                This project does not have email delivery configured yet, so the reset code is shown here after you
                request it.
              </p>
              <form onSubmit={handleResetPassword} className="auth-form">
                <div className="auth-field">
                  <label>Reset Code</label>
                  <input
                    type="text"
                    placeholder="Enter reset code"
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value.toUpperCase())}
                  />
                </div>

                {resetExpiryLabel && (
                  <div className="auth-code-box">
                    Code expires on <strong>{resetExpiryLabel}</strong>
                  </div>
                )}

                <div className="auth-field">
                  <label>New Password</label>
                  <div className="auth-password-input">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      <EyeIcon hidden={showNewPassword} />
                    </button>
                  </div>
                </div>

                <div className="auth-field">
                  <label>Confirm Password</label>
                  <div className="auth-password-input">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      <EyeIcon hidden={showConfirmPassword} />
                    </button>
                  </div>
                </div>

                <button type="submit" className="auth-secondary-btn" disabled={loading}>
                  {loading ? 'Updating...' : 'Reset Password'}
                </button>
              </form>
            </div>

            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                Back to login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
