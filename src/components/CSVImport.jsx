import { useRef, useState } from 'react'
import { CATEGORIES } from '../lib/expense-config'

const VALID_CATEGORIES = CATEGORIES.map(c => c.name)
const VALID_TYPES = ['expense', 'income']

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) throw new Error('CSV has no data rows.')

  // Strip BOM
  const raw = lines[0].startsWith('\uFEFF') ? lines[0].slice(1) : lines[0]
  const headers = raw.split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''))

  // Detect column indices flexibly
  const idx = {
    date: headers.findIndex(h => h.includes('date')),
    description: headers.findIndex(h => h.includes('desc') || h.includes('narration') || h.includes('particular')),
    category: headers.findIndex(h => h.includes('categ')),
    type: headers.findIndex(h => h.includes('type')),
    amount: headers.findIndex(h => h.includes('amount') || h.includes('inr') || h.includes('debit') || h.includes('credit')),
  }

  if (idx.date === -1 || idx.amount === -1)
    throw new Error('CSV must have at least "Date" and "Amount" columns.')

  const rows = []
  const errors = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Simple CSV split (handles quoted fields)
    const cols = []
    let inQuote = false, cur = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim())

    const raw_date = cols[idx.date]?.trim()
    const raw_amount = cols[idx.amount]?.trim().replace(/[₹$,\s]/g, '')
    const raw_desc = idx.description !== -1 ? cols[idx.description]?.trim() : `Row ${i}`
    const raw_type = idx.type !== -1 ? cols[idx.type]?.trim().toLowerCase() : ''
    const raw_cat = idx.category !== -1 ? cols[idx.category]?.trim() : ''

    // Validate date
    const date = new Date(raw_date)
    if (isNaN(date)) { errors.push(`Row ${i}: invalid date "${raw_date}"`); continue }
    const dateStr = date.toISOString().split('T')[0]

    // Validate amount
    const amount = parseFloat(raw_amount)
    if (isNaN(amount) || amount <= 0) { errors.push(`Row ${i}: invalid amount "${raw_amount}"`); continue }

    // Infer type
    let type = VALID_TYPES.includes(raw_type) ? raw_type : 'expense'

    // Map category
    let category = VALID_CATEGORIES.find(c => c.toLowerCase() === raw_cat.toLowerCase())
    if (!category) {
      if (type === 'income') category = 'Salary'
      else category = 'Other'
    }

    rows.push({
      date: dateStr,
      description: raw_desc || 'Imported transaction',
      amount,
      type,
      category,
    })
  }

  return { rows, errors }
}

export default function CSVImport({ onImport }) {
  const fileRef = useRef()
  const [status, setStatus] = useState(null) // { type: 'success'|'error'|'warning', msg }
  const [importing, setImporting] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    fileRef.current.value = ''

    setImporting(true)
    setStatus(null)

    try {
      const text = await file.text()
      const { rows, errors } = parseCSV(text)

      if (rows.length === 0) {
        setStatus({ type: 'error', msg: `No valid rows found. ${errors[0] ?? ''}` })
        setImporting(false)
        return
      }

      const { count, error } = await onImport(rows)

      if (error) {
        setStatus({ type: 'error', msg: `Import failed: ${error.message}` })
      } else if (errors.length > 0) {
        setStatus({ type: 'warning', msg: `Imported ${count} rows. ${errors.length} row(s) skipped: ${errors[0]}` })
      } else {
        setStatus({ type: 'success', msg: `Successfully imported ${count} transaction${count !== 1 ? 's' : ''}.` })
      }
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    }

    setImporting(false)
    setTimeout(() => setStatus(null), 5000)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <button
        className="btn btn-outline"
        onClick={() => fileRef.current.click()}
        disabled={importing}
        title="Upload a CSV file to import transactions"
      >
        {importing ? '⏳ Importing…' : '↑ Import CSV'}
      </button>
      {status && (
        <div className={`import-toast import-toast-${status.type}`}>
          {status.msg}
        </div>
      )}
    </div>
  )
}
