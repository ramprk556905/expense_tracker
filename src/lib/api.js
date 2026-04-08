const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim()
const BASE_URL = configuredBaseUrl
  ? configuredBaseUrl.replace(/\/$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:8000'
    : window.location.origin

const storages = [sessionStorage, localStorage]

const getStoredValue = (key) => {
  for (const storage of storages) {
    const value = storage.getItem(key)
    if (value) return value
  }
  return null
}

const clearSession = () => {
  for (const storage of storages) {
    storage.removeItem('et_token')
    storage.removeItem('et_user')
  }
}

const getToken = () => getStoredValue('et_token')
const getSessionStorageForToken = () => {
  if (localStorage.getItem('et_token')) return localStorage
  if (sessionStorage.getItem('et_token')) return sessionStorage
  return null
}

const setUser = (user) => {
  const storage = getSessionStorageForToken()
  if (!storage) return
  storage.setItem('et_user', JSON.stringify(user))
}

const syncUser = (patch) => {
  const current = getUser() || {}
  const next = { ...current, ...patch }
  setUser(next)
  return next
}

const getUser = () => {
  const raw = getStoredValue('et_user')
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    clearSession()
    return null
  }
}

const persistSession = (token, user, rememberMe) => {
  clearSession()
  const storage = rememberMe ? localStorage : sessionStorage
  storage.setItem('et_token', token)
  storage.setItem('et_user', JSON.stringify(user))
}

async function request(method, path, body, options = {}) {
  const { handleUnauthorized = true } = options
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
    if (handleUnauthorized) {
      clearSession()
      window.location.reload()
      return
    }
    throw new Error(data?.detail || 'Unauthorized')
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

  async login(email, password, rememberMe) {
    const data = await request('POST', '/auth/login', { email, password, remember_me: rememberMe }, { handleUnauthorized: false })
    persistSession(
      data.access_token,
      {
        email: data.email,
        rememberMe: data.remember_me,
        emailVerified: data.email_verified,
        notifyNewTransaction: data.notify_new_transaction,
      },
      data.remember_me,
    )
    return data
  },

  async register(email, password, rememberMe) {
    const data = await request('POST', '/auth/register', { email, password, remember_me: rememberMe }, { handleUnauthorized: false })
    persistSession(
      data.access_token,
      {
        email: data.email,
        rememberMe: data.remember_me,
        emailVerified: data.email_verified,
        notifyNewTransaction: data.notify_new_transaction,
      },
      data.remember_me,
    )
    return data
  },

  async getProfile() {
    const data = await request('GET', '/auth/profile')
    return syncUser({
      email: data.email,
      emailVerified: data.email_verified,
      notifyNewTransaction: data.notify_new_transaction,
    })
  },

  async changePassword(currentPassword, newPassword) {
    return request('POST', '/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },

  async requestEmailVerification() {
    return request('POST', '/auth/request-email-verification')
  },

  async verifyEmail(code) {
    const data = await request('POST', '/auth/verify-email', { code })
    return syncUser({
      email: data.email,
      emailVerified: data.email_verified,
      notifyNewTransaction: data.notify_new_transaction,
    })
  },

  async updateNotificationPreference(enabled) {
    const data = await request('PATCH', '/auth/preferences', {
      notify_new_transaction: enabled,
    })
    return syncUser({
      email: data.email,
      emailVerified: data.email_verified,
      notifyNewTransaction: data.notify_new_transaction,
    })
  },

  async forgotPassword(email) {
    return request('POST', '/auth/forgot-password', { email }, { handleUnauthorized: false })
  },

  async resetPassword(email, code, newPassword) {
    return request('POST', '/auth/reset-password', {
      email,
      code,
      new_password: newPassword,
    }, { handleUnauthorized: false })
  },

  async logout() {
    try {
      await request('POST', '/auth/logout', undefined, { handleUnauthorized: false })
    } catch {
      // Best-effort logout: local cleanup still matters if the backend session is already gone.
    } finally {
      clearSession()
    }
  },

  getAuthHistory: () => request('GET', '/auth/history'),
  getExpenses: () => request('GET', '/expenses'),
  addExpense: (data) => request('POST', '/expenses', data),
  updateExpense: (id, data) => request('PUT', `/expenses/${id}`, data),
  deleteExpense: (id) => request('DELETE', `/expenses/${id}`),
  bulkAdd: (rows) => request('POST', '/expenses/bulk', rows),
}
