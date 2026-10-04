import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin) - centre de
 * notifications reel. Ferme la lacune identifiee dans l'audit: les seuils
 * d'alerte de stock existaient deja comme donnee mais rien ne se
 * declenchait dessus.
 */
export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000) // rafraichit toutes les minutes
    return () => clearInterval(interval)
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/notifications/establishment')
      setNotifications(data)
    } catch (err) {
      setError(getErrorMessage(err, ''))
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`)
      await load()
    } catch {
      // silencieux, pas bloquant
    }
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all')
      await load()
    } catch {
      // silencieux, pas bloquant
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative p-2 rounded-full hover:bg-forest-50 transition" aria-label="Notifications">
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-clay-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-forest-100 rounded-xl shadow-lg z-10 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center p-3 border-b border-forest-100">
            <p className="text-sm font-medium text-forest-900">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-amber-600 hover:underline">Tout marquer comme lu</button>
            )}
          </div>
          {notifications.length === 0 && <p className="text-sm text-forest-700 p-4">Aucune notification.</p>}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`block w-full text-left p-3 border-b border-forest-50 hover:bg-forest-50 transition ${!n.is_read ? 'bg-amber-500/5' : ''}`}
            >
              <p className="text-sm text-forest-900 font-medium">{n.title}</p>
              <p className="text-xs text-forest-700">{n.message}</p>
              <p className="text-xs text-forest-500 mt-1">{new Date(n.created_at).toLocaleString('fr-FR')}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
