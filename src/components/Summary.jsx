import { formatINR as fmt } from '../App'

export default function Summary({ balance, totalIncome, totalExpenses, count }) {
  return (
    <div className="summary-grid">
      <div className={`summary-card ${balance >= 0 ? 'card-balance-pos' : 'card-balance-neg'}`}>
        <div className="summary-label">Balance</div>
        <div className="summary-amount">{fmt(balance)}</div>
        <div className="summary-sub">{count} transactions this month</div>
      </div>

      <div className="summary-card card-income">
        <div className="summary-label">Total Income</div>
        <div className="summary-amount income">{fmt(totalIncome)}</div>
        <div className="summary-sub">↑ Money in</div>
      </div>

      <div className="summary-card card-expense">
        <div className="summary-label">Total Expenses</div>
        <div className="summary-amount expense">{fmt(totalExpenses)}</div>
        <div className="summary-sub">↓ Money out</div>
      </div>

      <div className="summary-card card-savings">
        <div className="summary-label">Savings Rate</div>
        <div className="summary-amount">
          {totalIncome > 0 ? `${Math.max(0, ((balance / totalIncome) * 100)).toFixed(1)}%` : '—'}
        </div>
        <div className="summary-sub">Of income saved</div>
      </div>
    </div>
  )
}
