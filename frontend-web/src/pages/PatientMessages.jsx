import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import ChatWindow from '../components/ChatWindow'

const conversationKey = (c) => `${c.establishment_id}:${c.counterparty_user_id || 'guichet'}`

export default function PatientMessages() {
  const [conversations, setConversations] = useState([])
  // Une conversation = un interlocuteur (un medecin, une personne du
  // personnel, ou le guichet d'une pharmacie/labo) - plus un fil melange
  // par etablissement: chaque conversation reste privee entre le patient
  // et cette personne (decision de M. Faustin).
  const [selectedKey, setSelectedKey] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/messages/establishments')
      setConversations(data)
      if (data.length > 0 && !selectedKey) {
        setSelectedKey(conversationKey(data[0]))
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger tes conversations.'))
    }
  }

  const selected = conversations.find((c) => conversationKey(c) === selectedKey)
  const withParam = (c) => (c.counterparty_user_id ? `?with_user_id=${c.counterparty_user_id}` : '')

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">Messages</h1>
      <p className="text-forest-700 mb-8">
        Discute directement avec les médecins et les établissements avec qui tu as un rendez-vous, une commande ou une analyse en cours.
        Chaque conversation est privée : seule la personne à qui tu écris peut la lire.
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
                key={conversationKey(c)}
                onClick={() => setSelectedKey(conversationKey(c))}
                className={`w-full text-left rounded-xl border p-3 transition ${
                  selectedKey === conversationKey(c)
                    ? 'border-forest-700 bg-forest-50'
                    : 'border-forest-100 bg-white hover:bg-forest-50'
                }`}
              >
                <p className="text-forest-900 font-medium text-sm">{c.counterparty_name || c.establishment_name}</p>
                {c.counterparty_name && <p className="text-xs text-forest-700">{c.establishment_name}</p>}
                {c.last_message && <p className="text-xs text-forest-700 truncate">{c.last_message}</p>}
              </button>
            ))}
          </div>

          <div className="sm:col-span-2">
            {selected && (
              <ChatWindow
                key={conversationKey(selected)}
                fetchUrl={`/messages/conversation/${selected.establishment_id}${withParam(selected)}`}
                sendUrl={`/messages/conversation/${selected.establishment_id}${withParam(selected)}`}
                currentSenderRole="patient"
                title={selected.counterparty_name ? `${selected.counterparty_name} - ${selected.establishment_name}` : selected.establishment_name}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
