import { useState } from 'react'
import { api } from '../lib/api'

export default function AccountSettings({ user, onUserUpdate }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [verificationExpiry, setVerificationExpiry] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const notifyEnabled = user?.notifyNewTransaction !== false

  const clearFeedback = () => {
    setMessage('')
    setError('')
  }

  const onError = (err) => {
    setError(err?.message || 'Something went wrong.')
  }

  const requestVerificationCode = async () => {
    clearFeedback()
    setBusy(true)
    try {
      const data = await api.requestEmailVerification()
      setMessage(data.message)
      setGeneratedCode(data.verification_code || '')
      setVerificationExpiry(data.expires_at || '')
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  const submitVerificationCode = async (event) => {
    event.preventDefault()
    clearFeedback()
    if (!verificationCode.trim()) {
      setError('Enter the verification code.')
      return
    }

    setBusy(true)
    try {
      const updatedUser = await api.verifyEmail(verificationCode)
      onUserUpdate(updatedUser)
      setMessage('Email verified successfully.')
      setGeneratedCode('')
      setVerificationExpiry('')
      setVerificationCode('')
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  const submitPasswordChange = async (event) => {
    event.preventDefault()
    clearFeedback()

    if (!currentPassword || !newPassword) {
      setError('Current and new password are required.')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.')
      return
    }

    setBusy(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setMessage('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  const toggleNotification = async (event) => {
    clearFeedback()
    const nextEnabled = event.target.checked
    setBusy(true)
    try {
      const updatedUser = await api.updateNotificationPreference(nextEnabled)
      onUserUpdate(updatedUser)
      setMessage(nextEnabled ? 'Notifications enabled.' : 'Notifications disabled.')
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  const expiryLabel = verificationExpiry
    ? new Date(verificationExpiry).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : ''

  return (
    <section className="settings-grid">
      <div className="settings-card">
        <h2 className="section-title">Email Verification</h2>
        <p className="settings-sub">Status: {user?.emailVerified ? 'Verified' : 'Not verified'}</p>
        {!user?.emailVerified && (
          <>
            <button type="button" className="btn btn-outline" onClick={requestVerificationCode} disabled={busy}>
              {busy ? 'Please wait...' : 'Get Verification Code'}
            </button>
            {generatedCode && (
              <div className="settings-code-box">
                Verification code: <strong>{generatedCode}</strong>
                {expiryLabel && <div>Expires on {expiryLabel}</div>}
              </div>
            )}
            <form onSubmit={submitVerificationCode} className="settings-form">
              <div className="form-group">
                <label>Verification Code</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.toUpperCase())}
                  placeholder="Enter code"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Verify Email
              </button>
            </form>
          </>
        )}
      </div>

      <div className="settings-card">
        <h2 className="section-title">Change Password</h2>
        <form onSubmit={submitPasswordChange} className="settings-form">
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Update Password
          </button>
        </form>
      </div>

      <div className="settings-card">
        <h2 className="section-title">Notifications</h2>
        <p className="settings-sub">Show a notification when a new transaction is added.</p>
        <label className="settings-toggle-row">
          <input type="checkbox" checked={notifyEnabled} onChange={toggleNotification} disabled={busy} />
          <span>Notify on new transaction</span>
        </label>
      </div>

      {(message || error) && (
        <div className={`settings-alert ${error ? 'settings-alert-error' : 'settings-alert-success'}`}>
          {error || message}
        </div>
      )}
    </section>
  )
}
