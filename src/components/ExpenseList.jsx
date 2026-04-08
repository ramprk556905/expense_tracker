import { useState } from 'react'
import { CATEGORIES } from '../App'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric'
})

export default function ExpenseList({ expenses, onEdit, onDelete, compact = false }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sortBy, setSortBy] = useState('date')

  const filtered = expenses
    .filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false
      if (filterCategory !== 'all' && e.category !== filterCategory) return false
      if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.date) - new Date(a.date)
      if (sortBy === 'amount') return b.amount - a.amount
      if (sortBy === 'category') return a.category.localeCompare(b.category)
      return 0
    })

  const getCategoryIcon = (name) => CATEGORIES.find(c => c.name === name)?.icon ?? '📦'
  const getCategoryColor = (name) => CATEGORIES.find(c => c.name === name)?.color ?? '#6b7280'

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <p>No transactions this month.</p>
        <p className="empty-sub">Click "+ Add Transaction" to get started.</p>
      </div>
    )
  }

  return (
    <div className="expense-list">
      {!compact && (
        <div className="list-controls">
          <input
            className="search-input"
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="category">Sort: Category</option>
          </select>
        </div>
      )}

      <div className="transactions">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No transactions match your filters.</p></div>
        ) : (
          filtered.map(expense => (
            <div key={expense.id} className="transaction-row">
              <div
                className="tx-icon"
                style={{ backgroundColor: getCategoryColor(expense.category) + '20', color: getCategoryColor(expense.category) }}
              >
                {getCategoryIcon(expense.category)}
              </div>
              <div className="tx-info">
                <div className="tx-desc">{expense.description}</div>
                <div className="tx-meta">
                  <span className="tx-category" style={{ color: getCategoryColor(expense.category) }}>
                    {expense.category}
                  </span>
                  <span className="tx-date">{fmtDate(expense.date)}</span>
                </div>
              </div>
              <div className={`tx-amount ${expense.type === 'income' ? 'income' : 'expense'}`}>
                {expense.type === 'income' ? '+' : '-'}{fmt(expense.amount)}
              </div>
              {!compact && (
                <div className="tx-actions">
                  <button className="action-btn edit-btn" onClick={() => onEdit(expense)} title="Edit">✏️</button>
                  <button className="action-btn delete-btn" onClick={() => onDelete(expense.id)} title="Delete">🗑️</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
