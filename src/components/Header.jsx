import { supabase } from '../lib/supabase'

export default function Header({ activeTab, setActiveTab, onAdd, user }) {
  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <span className="logo-icon">💰</span>
          <span className="logo-text">ExpenseTracker</span>
        </div>

        <nav className="nav">
          <button
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </button>
        </nav>

        <div className="header-right">
          <button className="btn btn-primary" onClick={onAdd}>
            + Add Transaction
          </button>
          <div className="user-menu">
            <div className="user-avatar" title={user?.email}>{initials}</div>
            <div className="user-dropdown">
              <div className="user-email">{user?.email}</div>
              <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
