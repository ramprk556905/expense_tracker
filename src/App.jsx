import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Header from './components/Header'
import Summary from './components/Summary'
import ExpenseForm from './components/ExpenseForm'
import ExpenseList from './components/ExpenseList'
import CategoryChart from './components/CategoryChart'
import MonthlyChart from './components/MonthlyChart'
import './App.css'

export const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

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
  const [expenses, setExpenses] = useState(() => loadFromStorage() ?? [])
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

  const buildCSV = (rows) => {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount (INR)']
    const lines = rows
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(e => [e.date, `"${e.description}"`, e.category, e.type, e.amount.toFixed(2)])
    return [headers, ...lines].map(r => r.join(',')).join('\n')
  }

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportMonthCSV = () => downloadCSV(buildCSV(filteredExpenses), `expenses-${filterMonth}.csv`)
  const exportMasterCSV = () => downloadCSV(buildCSV(expenses), `expenses-master-all.csv`)

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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={exportMonthCSV}>
              ↓ Month CSV
            </button>
            <button className="btn btn-outline" onClick={exportMasterCSV}>
              ↓ Master CSV
            </button>
          </div>
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
