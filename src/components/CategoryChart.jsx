import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CATEGORIES, formatINR as fmt } from '../lib/expense-config'

export default function CategoryChart({ expenses }) {
  const expensesOnly = expenses.filter(e => e.type === 'expense')

  const data = CATEGORIES
    .filter(c => c.name !== 'Salary')
    .map(c => ({
      name: c.name,
      value: expensesOnly.filter(e => e.category === c.name).reduce((s, e) => s + e.amount, 0),
      color: c.color,
      icon: c.icon,
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Spending by Category</h3>
        <div className="empty-state"><p>No expense data yet.</p></div>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="chart-card">
      <h3 className="chart-title">Spending by Category</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [fmt(v), 'Amount']} />
          <Legend
            formatter={(value) => {
              const item = data.find(d => d.name === value)
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0
              return `${value} (${pct}%)`
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="category-breakdown">
        {data.slice(0, 4).map(d => (
          <div key={d.name} className="category-row">
            <div className="cat-left">
              <span>{d.icon}</span>
              <span className="cat-name">{d.name}</span>
            </div>
            <div className="cat-right">
              <div className="cat-bar-wrap">
                <div
                  className="cat-bar"
                  style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }}
                />
              </div>
              <span className="cat-amount">{fmt(d.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
