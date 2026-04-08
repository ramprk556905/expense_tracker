const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const shortenAgent = (value) => {
  if (!value) return 'Unknown device'
  if (value.includes('Chrome')) return 'Chrome browser'
  if (value.includes('Firefox')) return 'Firefox browser'
  if (value.includes('Safari') && !value.includes('Chrome')) return 'Safari browser'
  if (value.includes('Edg')) return 'Edge browser'
  return value.length > 42 ? `${value.slice(0, 42)}...` : value
}

export default function LoginHistory({ history, loading }) {
  const activeUsers = [...new Set(history.filter((entry) => entry.active).map((entry) => entry.email))]

  return (
    <section className="history-card">
      <div className="history-head">
        <div>
          <h3 className="chart-title">Login History</h3>
          <p className="history-subtitle">Recent sign-ins across the app, including active remembered sessions.</p>
        </div>
        <div className="history-stats">
          <div className="history-stat">
            <strong>{activeUsers.length}</strong>
            <span>Active users</span>
          </div>
          <div className="history-stat">
            <strong>{history.length}</strong>
            <span>Recent sessions</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <p>Loading login history...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <p>No login activity yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((entry, index) => (
            <div key={`${entry.email}-${entry.created_at}-${index}`} className="history-row">
              <div className="history-main">
                <div className="history-email">{entry.email}</div>
                <div className="history-meta">
                  <span>{shortenAgent(entry.user_agent)}</span>
                  {entry.ip_address && <span>{entry.ip_address}</span>}
                  <span>{entry.remember_me ? 'Remembered session' : 'Session-only login'}</span>
                </div>
              </div>
              <div className="history-side">
                <span className={`history-badge ${entry.active ? 'active' : 'ended'}`}>
                  {entry.active ? 'Active' : 'Ended'}
                </span>
                <div className="history-time">Signed in {formatDateTime(entry.created_at)}</div>
                <div className="history-time">
                  {entry.active ? `Last seen ${formatDateTime(entry.last_seen_at)}` : `Signed out ${formatDateTime(entry.logged_out_at || entry.last_seen_at)}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
