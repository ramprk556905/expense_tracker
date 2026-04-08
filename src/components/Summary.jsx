import { formatINR as fmt } from '../lib/expense-config'

export default function Summary({ budget, prevMonthSalary, currentMonthIncome, totalExpenses, remaining, count, prevMonthLabel }) {
  const spentPct = budget > 0 ? Math.min((totalExpenses / budget) * 100, 100) : 0
  const overBudget = budget > 0 && remaining < 0

  return (
    <div className="summary-wrapper">
      <div className="budget-source-note">
        💼 Budget source: <strong>{prevMonthLabel}</strong> salary + current month income (including delayed salary credits)
        {budget === 0 && <span className="budget-warn"> — no income recorded yet</span>}
      </div>

      <div className="summary-grid">
        <div className={`summary-card ${overBudget ? 'card-balance-neg' : 'card-balance-pos'}`}>
          <div className="summary-label">Remaining Budget</div>
          <div className={`summary-amount ${overBudget ? 'expense' : 'income'}`}>{fmt(remaining)}</div>
          <div className="summary-sub">{overBudget ? '⚠ Over budget' : '✓ Within budget'}</div>
        </div>

        <div className="summary-card card-income">
          <div className="summary-label">Income Considered</div>
          <div className="summary-amount income">{budget > 0 ? fmt(budget) : '—'}</div>
          <div className="summary-sub">
            {`Prev salary: ${fmt(prevMonthSalary || 0)} | This month income: ${fmt(currentMonthIncome || 0)}`}
          </div>
        </div>

        <div className="summary-card card-expense">
          <div className="summary-label">Total Spent</div>
          <div className="summary-amount expense">{fmt(totalExpenses)}</div>
          <div className="summary-sub">{count} transactions this month</div>
        </div>

        <div className="summary-card card-savings">
          <div className="summary-label">Budget Used</div>
          <div className="summary-amount" style={{ color: overBudget ? 'var(--danger)' : spentPct > 80 ? 'var(--warning)' : 'var(--success)' }}>
            {budget > 0 ? `${spentPct.toFixed(1)}%` : '—'}
          </div>
          <div className="budget-bar-wrap">
            <div
              className="budget-bar"
              style={{
                width: `${spentPct}%`,
                backgroundColor: overBudget ? 'var(--danger)' : spentPct > 80 ? 'var(--warning)' : 'var(--success)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
