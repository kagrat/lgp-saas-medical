import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import ChatWindow from './ChatWindow'

export default function SupportInbox() {
  const [threads, setThreads] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/support/threads')
      setThreads(data)
      if (data.length > 0 && !selectedUserId) {
        setSelectedUserId(data[0].user_id)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les messages support.'))
    }
  }

  const selected = threads.find((t) => t.user_id === selectedUserId)

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {threads.length === 0 ? (
        <p className="text-forest-700">Aucun message support pour le moment.</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            {threads.map((t) => (
              <button
                key={t.user_id}
                onClick={() => setSelectedUserId(t.user_id)}
                className={`w-full text-left rounded-xl border p-3 transition ${
                  selectedUserId === t.user_id
                    ? 'border-forest-700 bg-forest-50'
                    : 'border-forest-100 bg-white hover:bg-forest-50'
                }`}
              >
                <p className="text-forest-900 font-medium text-sm">{t.user_name}</p>
                <p className="text-xs text-forest-700">{t.user_role}</p>
                {t.last_message && <p className="text-xs text-forest-700 truncate">{t.last_message}</p>}
              </button>
            ))}
          </div>
          <div className="sm:col-span-2">
            {selected && (
              <ChatWindow
                key={selected.user_id}
                fetchUrl={`/support/thread/${selected.user_id}`}
                sendUrl={`/support/thread/${selected.user_id}`}
                currentSenderRole="support"
                title={selected.user_name}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
