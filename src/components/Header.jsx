export default function Header({ activeTab, setActiveTab, onAdd }) {
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

        <button className="btn btn-primary" onClick={onAdd}>
          + Add Transaction
        </button>
      </div>
    </header>
  )
}
