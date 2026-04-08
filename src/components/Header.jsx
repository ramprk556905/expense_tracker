import { useEffect, useRef, useState } from 'react'

export default function Header({ activeTab, setActiveTab, onAdd, user, onLogout }) {
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??'
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const handleLogoutClick = async () => {
    setLoggingOut(true)
    try {
      await onLogout()
    } finally {
      setLoggingOut(false)
      setMenuOpen(false)
    }
  }

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <span className="logo-icon">💰</span>
          <span className="logo-text">ExpenseTracker</span>
        </div>

        <nav className="nav">
          <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-btn ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
            Transactions
          </button>
          <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            Settings
          </button>
        </nav>

        <div className="header-right">
          <button className="btn btn-primary" onClick={onAdd}>+ Add Transaction</button>
          <div className={`user-menu ${menuOpen ? 'open' : ''}`} ref={menuRef}>
            <button
              type="button"
              className="user-avatar"
              title={user?.email}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {initials}
            </button>
            <div className="user-dropdown">
              <div className="user-email">{user?.email}</div>
              <div className="user-email">Session: {user?.rememberMe ? 'Remembered on this device' : 'This browser only'}</div>
              <button type="button" className="logout-btn" onClick={handleLogoutClick} disabled={loggingOut}>
                {loggingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
