import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import Auth from './components/Auth'
import Header from './components/Header'
import Summary from './components/Summary'
import ExpenseForm from './components/ExpenseForm'
import ExpenseList from './components/ExpenseList'
import CategoryChart from './components/CategoryChart'
import MonthlyChart from './components/MonthlyChart'
import CSVImport from './components/CSVImport'
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

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [expenses, setExpenses] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load expenses when user logs in
  const loadExpenses = useCallback(async (uid) => {
    setDataLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false })
    if (!error) setExpenses(data)
    setDataLoading(false)
  }, [])

  useEffect(() => {
    if (user) loadExpenses(user.id)
    else setExpenses([])
  }, [user, loadExpenses])

  const addExpense = async (data) => {
    const { data: row, error } = await supabase
      .from('expenses')
      .insert([{ ...data, user_id: user.id }])
      .select()
      .single()
    if (!error) setExpenses(prev => [row, ...prev])
    setShowForm(false)
  }

  const updateExpense = async (data) => {
    const { description, amount, category, date, type } = data
    const { error } = await supabase
      .from('expenses')
      .update({ description, amount, category, date, type })
      .eq('id', data.id)
      .eq('user_id', user.id)
    if (!error) setExpenses(prev => prev.map(e => e.id === data.id ? { ...e, ...data } : e))
    setEditingExpense(null)
    setShowForm(false)
  }

  const deleteExpense = async (id) => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const bulkAddExpenses = async (rows) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert(rows.map(r => ({ ...r, user_id: user.id })))
      .select()
    if (!error) setExpenses(prev => [...data, ...prev])
    return { count: data?.length ?? 0, error }
  }

  const handleEdit = (expense) => { setEditingExpense(expense); setShowForm(true) }
  const handleFormClose = () => { setShowForm(false); setEditingExpense(null) }

  // Budget logic: prev month salary → current month budget
  const filteredExpenses = expenses.filter(e => e.date.startsWith(filterMonth))

  const prevMonth = (() => {
    const [y, m] = filterMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const prevMonthLabel = (() => {
    const [y, m] = prevMonth.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  })()

  const budget = expenses
    .filter(e => e.date.startsWith(prevMonth) && e.type === 'income')
    .reduce((s, e) => s + e.amount, 0)
  const totalExpenses = filteredExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const remaining = budget - totalExpenses

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
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const exportMonthCSV = () => downloadCSV(buildCSV(filteredExpenses), `expenses-${filterMonth}.csv`)
  const exportMasterCSV = () => downloadCSV(buildCSV(expenses), `expenses-master-all.csv`)

  if (!supabaseConfigured) {
    return (
      <div className="splash">
        <span className="splash-icon">⚙️</span>
        <p style={{ color: '#ef4444', fontWeight: 600 }}>Supabase not configured</p>
        <p style={{ fontSize: 13, maxWidth: 360, textAlign: 'center', color: '#64748b' }}>
          Set <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY</strong> in your environment variables and redeploy.
        </p>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="splash">
        <span className="splash-icon">💰</span>
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) return <Auth />

  return (
    <div className="app">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdd={() => { setEditingExpense(null); setShowForm(true) }}
        user={user}
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <CSVImport onImport={bulkAddExpenses} />
            <button className="btn btn-outline" onClick={exportMonthCSV}>↓ Month CSV</button>
            <button className="btn btn-outline" onClick={exportMasterCSV}>↓ Master CSV</button>
          </div>
        </div>

        {dataLoading ? (
          <div className="data-loading">Loading your transactions…</div>
        ) : (
          <>
            <Summary
              budget={budget}
              totalExpenses={totalExpenses}
              remaining={remaining}
              count={filteredExpenses.length}
              prevMonthLabel={prevMonthLabel}
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
          </>
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
