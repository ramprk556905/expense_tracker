export const formatINR = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)

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
