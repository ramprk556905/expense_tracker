const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim()
const BASE_URL = configuredBaseUrl
  ? configuredBaseUrl.replace(/\/$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:8000'
    : window.location.origin

const getToken = () => localStorage.getItem('et_token')
const setToken = (token) => localStorage.setItem('et_token', token)
const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('et_user') || 'null')
  } catch {
    localStorage.removeItem('et_user')
    return null
  }
}
const setUser = (user) => localStorage.setItem('et_user', JSON.stringify(user))

async function request(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json().catch(() => ({})) : null

  if (response.status === 401) {
    localStorage.removeItem('et_token')
    localStorage.removeItem('et_user')
    window.location.reload()
    return
  }

  if (!response.ok) throw new Error(data?.detail || `Request failed (${response.status})`)

  if (!isJson) {
    throw new Error(
      import.meta.env.DEV
        ? `Expected a JSON API response from ${BASE_URL}${path}, but received ${contentType || 'an unknown response type'}.`
        : 'The frontend could not reach the API. Set VITE_API_URL to your backend URL and redeploy.',
    )
  }

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

  getExpenses: () => request('GET', '/expenses'),
  addExpense: (data) => request('POST', '/expenses', data),
  updateExpense: (id, data) => request('PUT', `/expenses/${id}`, data),
  deleteExpense: (id) => request('DELETE', `/expenses/${id}`),
  bulkAdd: (rows) => request('POST', '/expenses/bulk', rows),
}
