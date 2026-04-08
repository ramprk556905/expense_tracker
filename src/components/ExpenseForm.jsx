import { useState, useEffect } from 'react'
import { CATEGORIES } from '../lib/expense-config'

export default function ExpenseForm({ expense, onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'Food & Dining',
    date: today,
    type: 'expense',
  })

  useEffect(() => {
    if (expense) {
      setForm({
        description: expense.description,
        amount: String(expense.amount),
        category: expense.category,
        date: expense.date,
        type: expense.type,
      })
    }
  }, [expense])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount || isNaN(Number(form.amount))) return
    onSave({
      ...(expense ? { id: expense.id } : {}),
      description: form.description.trim(),
      amount: Math.abs(parseFloat(form.amount)),
      category: form.category,
      date: form.date,
      type: form.type,
    })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{expense ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="form-type-toggle">
            <button
              type="button"
              className={`type-btn ${form.type === 'expense' ? 'active-expense' : ''}`}
              onClick={() => {
                set('type', 'expense')
                const cat = form.category
                if (cat === 'Salary') set('category', 'Food & Dining')
              }}
            >
              Expense
            </button>
            <button
              type="button"
              className={`type-btn ${form.type === 'income' ? 'active-income' : ''}`}
              onClick={() => {
                set('type', 'income')
                set('category', 'Salary')
              }}
            >
              Income
            </button>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              placeholder="What was this for?"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES
                .filter(c => form.type === 'income' ? c.name === 'Salary' || c.name === 'Other' : c.name !== 'Salary')
                .map(c => (
                  <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {expense ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
