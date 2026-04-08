import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Header from './components/Header'
import Summary from './components/Summary'
import ExpenseForm from './components/ExpenseForm'
import ExpenseList from './components/ExpenseList'
import CategoryChart from './components/CategoryChart'
import MonthlyChart from './components/MonthlyChart'
import './App.css'

export const CATEGORIES = [
  { name: 'Food & Dining', color: '#f97316', icon: '🍔' },
  { name: 'Transport', color: '#3b82f6', icon: '🚗' },
  { name: 'Housing', color: '#8b5cf6', icon: '🏠' },
  { name: 'Bills & Utilities', color: '#ef4444', icon: '⚡' },
  { name: 'Entertainment', color: '#ec4899', icon: '🎬' },
  { name: 'Healthcare', color: '#14b8a6', icon: '🏥' },
  { name: 'Education', color: '#06b6d4', icon: '📚' },
  { name: 'Shopping', color: '#f59e0b', icon: '🛍️' },
  { name: 'Salary', color: '#22c55e', icon: '💼' },
  { name: 'Other', color: '#6b7280', icon: '📦' },
]

const SAMPLE_DATA = [
  { id: uuidv4(), description: 'Grocery shopping', amount: 85.50, category: 'Food & Dining', date: '2026-04-01', type: 'expense' },
  { id: uuidv4(), description: 'Monthly salary', amount: 4500.00, category: 'Salary', date: '2026-04-01', type: 'income' },
  { id: uuidv4(), description: 'Electric bill', amount: 95.00, category: 'Bills & Utilities', date: '2026-04-02', type: 'expense' },
  { id: uuidv4(), description: 'Uber ride', amount: 18.50, category: 'Transport', date: '2026-04-03', type: 'expense' },
  { id: uuidv4(), description: 'Netflix subscription', amount: 15.99, category: 'Entertainment', date: '2026-04-04', type: 'expense' },
  { id: uuidv4(), description: 'Lunch at office', amount: 12.00, category: 'Food & Dining', date: '2026-04-05', type: 'expense' },
  { id: uuidv4(), description: 'Doctor visit', amount: 50.00, category: 'Healthcare', date: '2026-04-06', type: 'expense' },
  { id: uuidv4(), description: 'Online course', amount: 29.99, category: 'Education', date: '2026-04-07', type: 'expense' },
]

function loadFromStorage() {
  try {
    const data = localStorage.getItem('expense_tracker_data')
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

function saveToStorage(expenses) {
  localStorage.setItem('expense_tracker_data', JSON.stringify(expenses))
}

export default function App() {
  const [expenses, setExpenses] = useState(() => loadFromStorage() ?? SAMPLE_DATA)
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    saveToStorage(expenses)
  }, [expenses])

  const addExpense = (data) => {
    setExpenses(prev => [{ ...data, id: uuidv4() }, ...prev])
    setShowForm(false)
  }

  const updateExpense = (data) => {
    setExpenses(prev => prev.map(e => e.id === data.id ? data : e))
    setEditingExpense(null)
    setShowForm(false)
  }

  const deleteExpense = (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingExpense(null)
  }

  const filteredExpenses = expenses.filter(e => e.date.startsWith(filterMonth))

  const totalIncome = filteredExpenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const totalExpenses = filteredExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const balance = totalIncome - totalExpenses

  const exportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount']
    const rows = filteredExpenses.map(e => [
      e.date, `"${e.description}"`, e.category, e.type, e.amount.toFixed(2)
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${filterMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdd={() => { setEditingExpense(null); setShowForm(true) }}
      />

      <main className="main-content">
        <div className="toolbar">
          <div className="month-picker">
            <label>Month</label>
            <input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
            />
          </div>
          <button className="btn btn-outline" onClick={exportCSV}>
            ↓ Export CSV
          </button>
        </div>

        <Summary
          balance={balance}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          count={filteredExpenses.length}
        />

        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            <CategoryChart expenses={filteredExpenses} />
            <MonthlyChart expenses={expenses} />
          </div>
        )}

        {activeTab === 'transactions' && (
          <ExpenseList
            expenses={filteredExpenses}
            onEdit={handleEdit}
            onDelete={deleteExpense}
          />
        )}

        {activeTab === 'dashboard' && (
          <div className="recent-section">
            <h2 className="section-title">Recent Transactions</h2>
            <ExpenseList
              expenses={filteredExpenses.slice(0, 5)}
              onEdit={handleEdit}
              onDelete={deleteExpense}
              compact
            />
          </div>
        )}
      </main>

      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          onSave={editingExpense ? updateExpense : addExpense}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
