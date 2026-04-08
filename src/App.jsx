import { useState, useEffect, useCallback } from 'react'
import { api } from './lib/api'
import { formatINR } from './lib/expense-config'
import Auth from './components/Auth'
import Header from './components/Header'
import Summary from './components/Summary'
import ExpenseForm from './components/ExpenseForm'
import ExpenseList from './components/ExpenseList'
import CategoryChart from './components/CategoryChart'
import MonthlyChart from './components/MonthlyChart'
import CSVImport from './components/CSVImport'
import LoginHistory from './components/LoginHistory'
import AccountSettings from './components/AccountSettings'
import './App.css'

export default function App() {
  const [user, setUser] = useState(api.getUser)
  const [expenses, setExpenses] = useState([])
  const [authHistory, setAuthHistory] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [notification, setNotification] = useState('')
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const loadExpenses = useCallback(async () => {
    setDataLoading(true)
    try {
      const data = await api.getExpenses()
      setExpenses(Array.isArray(data) ? data : [])
    } catch {
      setExpenses([])
    } finally {
      setDataLoading(false)
    }
  }, [])

  const loadAuthHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await api.getAuthHistory()
      setAuthHistory(Array.isArray(data) ? data : [])
    } catch {
      setAuthHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadExpenses()
      loadAuthHistory()
    } else {
      setExpenses([])
      setAuthHistory([])
    }
  }, [user, loadExpenses, loadAuthHistory])

  useEffect(() => {
    if (!user) return
    api.getProfile().then(setUser).catch(() => {})
  }, [user?.email])

  useEffect(() => {
    if (!notification) return
    const timeout = setTimeout(() => setNotification(''), 3000)
    return () => clearTimeout(timeout)
  }, [notification])

  const handleLoginSuccess = (userData) => setUser(userData)

  const handleLogout = async () => {
    await api.logout()
    setUser(null)
    setExpenses([])
    setAuthHistory([])
  }

  const addExpense = async (data) => {
    try {
      const row = await api.addExpense(data)
      setExpenses((prev) => [row, ...prev])
      if (user?.notifyNewTransaction !== false) {
        setNotification('New transaction added successfully.')
      }
    } catch (error) {
      alert(error.message)
    }
    setShowForm(false)
  }

  const updateExpense = async (data) => {
    try {
      const row = await api.updateExpense(data.id, data)
      setExpenses((prev) => prev.map((expense) => (expense.id === data.id ? row : expense)))
    } catch (error) {
      alert(error.message)
    }
    setEditingExpense(null)
    setShowForm(false)
  }

  const deleteExpense = async (id) => {
    try {
      await api.deleteExpense(id)
      setExpenses((prev) => prev.filter((expense) => expense.id !== id))
    } catch (error) {
      alert(error.message)
    }
  }

  const bulkAddExpenses = async (rows) => {
    try {
      const data = await api.bulkAdd(rows)
      const importedRows = Array.isArray(data) ? data : []
      setExpenses((prev) => [...importedRows, ...prev])
      return { count: importedRows.length, error: null }
    } catch (error) {
      return { count: 0, error }
    }
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingExpense(null)
  }

  const safeExpenses = Array.isArray(expenses) ? expenses : []
  const filteredExpenses = safeExpenses.filter((expense) => expense.date.startsWith(filterMonth))

  const prevMonth = (() => {
    const [year, month] = filterMonth.split('-').map(Number)
    const date = new Date(year, month - 2, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })()

  const prevMonthLabel = (() => {
    const [year, month] = prevMonth.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    })
  })()

  const budget = safeExpenses
    .filter((expense) => expense.date.startsWith(prevMonth) && expense.type === 'income')
    .reduce((sum, expense) => sum + expense.amount, 0)
  const currentMonthIncome = filteredExpenses
    .filter((expense) => expense.type === 'income')
    .reduce((sum, expense) => sum + expense.amount, 0)
  const availableBudget = budget + currentMonthIncome
  const totalExpenses = filteredExpenses
    .filter((expense) => expense.type === 'expense')
    .reduce((sum, expense) => sum + expense.amount, 0)
  const remaining = availableBudget - totalExpenses

  const buildCSV = (rows) => {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount (INR)']
    const lines = rows
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((expense) => [
        expense.date,
        `"${expense.description}"`,
        expense.category,
        expense.type,
        expense.amount.toFixed(2),
      ])
    return [headers, ...lines].map((row) => row.join(',')).join('\n')
  }

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (!user) return <Auth onSuccess={handleLoginSuccess} />

  return (
    <div className="app">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdd={() => {
          setEditingExpense(null)
          setShowForm(true)
        }}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="main-content">
        <div className="toolbar">
          <div className="month-picker">
            <label>Month</label>
            <input type="month" value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <CSVImport onImport={bulkAddExpenses} />
            <button
              className="btn btn-outline"
              onClick={() => downloadCSV(buildCSV(filteredExpenses), `expenses-${filterMonth}.csv`)}
            >
              Download Month CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => downloadCSV(buildCSV(safeExpenses), 'expenses-master-all.csv')}
            >
              Download Master CSV
            </button>
          </div>
        </div>

        {dataLoading ? (
          <div className="data-loading">Loading your transactions...</div>
        ) : (
          <>
            {notification && <div className="inline-toast">{notification}</div>}

            <Summary
              budget={availableBudget}
              prevMonthSalary={budget}
              currentMonthIncome={currentMonthIncome}
              totalExpenses={totalExpenses}
              remaining={remaining}
              count={filteredExpenses.length}
              prevMonthLabel={prevMonthLabel}
            />

            {activeTab === 'dashboard' && (
              <>
                <div className="dashboard-grid">
                  <CategoryChart expenses={filteredExpenses} />
                  <MonthlyChart expenses={safeExpenses} />
                </div>

                <LoginHistory history={authHistory} loading={historyLoading} />
              </>
            )}

            {activeTab === 'transactions' && (
              <ExpenseList expenses={filteredExpenses} onEdit={handleEdit} onDelete={deleteExpense} />
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
          </>
        )}
      </main>

      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          onSave={editingExpense ? updateExpense : addExpense}
          onClose={handleClose}
        />
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setShowSettings(false)}>
          <div className="modal settings-modal">
            <div className="modal-header">
              <h2>Account Settings</h2>
              <button className="modal-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="settings-modal-body">
              <AccountSettings user={user} onUserUpdate={setUser} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
