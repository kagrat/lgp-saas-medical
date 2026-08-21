import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import ChatWindow from '../components/ChatWindow'

export default function PatientMessages() {
  const [conversations, setConversations] = useState([])
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/messages/establishments')
      setConversations(data)
      if (data.length > 0 && !selectedEstablishmentId) {
        setSelectedEstablishmentId(data[0].establishment_id)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger tes conversations.'))
    }
  }

  const selected = conversations.find((c) => c.establishment_id === selectedEstablishmentId)

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">Messages</h1>
      <p className="text-forest-700 mb-8">
        Discute directement avec les établissements ou tu as un rendez-vous, une commande ou une analyse en cours.
      </p>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {conversations.length === 0 ? (
        <p className="text-forest-700">
          Tu n'as pas encore d'établissement avec qui discuter. Prends d'abord rendez-vous, commande un
          médicament ou demande une analyse - une conversation s'ouvrira automatiquement avec cet établissement.
        </p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            {conversations.map((c) => (
              <button
                key={c.establishment_id}
                onClick={() => setSelectedEstablishmentId(c.establishment_id)}
                className={`w-full text-left rounded-xl border p-3 transition ${
                  selectedEstablishmentId === c.establishment_id
                    ? 'border-forest-700 bg-forest-50'
                    : 'border-forest-100 bg-white hover:bg-forest-50'
                }`}
              >
                <p className="text-forest-900 font-medium text-sm">{c.establishment_name}</p>
                {c.last_message && <p className="text-xs text-forest-700 truncate">{c.last_message}</p>}
              </button>
            ))}
          </div>

          <div className="sm:col-span-2">
            {selected && (
              <ChatWindow
                key={selected.establishment_id}
                fetchUrl={`/messages/conversation/${selected.establishment_id}`}
                sendUrl={`/messages/conversation/${selected.establishment_id}`}
                currentSenderRole="patient"
                title={selected.establishment_name}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
