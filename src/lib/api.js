const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const getToken = () => localStorage.getItem('et_token')
const setToken = (t) => localStorage.setItem('et_token', t)
const getUser  = () => JSON.parse(localStorage.getItem('et_user') || 'null')
const setUser  = (u) => localStorage.setItem('et_user', JSON.stringify(u))

async function request(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (res.status === 401) {
    localStorage.removeItem('et_token')
    localStorage.removeItem('et_user')
    window.location.reload()
    return
  }

  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
  return data
}

export const api = {
  getUser,

  async login(email, password) {
    const data = await request('POST', '/auth/login', { email, password })
    setToken(data.access_token)
    setUser({ email: data.email })
    return data
  },

  async register(email, password) {
    const data = await request('POST', '/auth/register', { email, password })
    setToken(data.access_token)
    setUser({ email: data.email })
    return data
  },

  logout() {
    localStorage.removeItem('et_token')
    localStorage.removeItem('et_user')
  },

  getExpenses:   ()         => request('GET',    '/expenses'),
  addExpense:    (data)     => request('POST',   '/expenses', data),
  updateExpense: (id, data) => request('PUT',    `/expenses/${id}`, data),
  deleteExpense: (id)       => request('DELETE', `/expenses/${id}`),
  bulkAdd:       (rows)     => request('POST',   '/expenses/bulk', rows),
}
