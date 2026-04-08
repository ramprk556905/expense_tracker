import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatINR } from '../App'

const fmt = (n) => `₹${n.toLocaleString('en-IN')}`

export default function MonthlyChart({ expenses }) {
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const monthExpenses = expenses.filter(e => e.date.startsWith(key))
    months.push({
      month: label,
      Income: monthExpenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0),
      Expenses: monthExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0),
    })
  }

  return (
    <div className="chart-card">
      <h3 className="chart-title">6-Month Overview</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={months} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={60} />
          <Tooltip formatter={(v) => [formatINR(v), '']} />
          <Legend />
          <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
