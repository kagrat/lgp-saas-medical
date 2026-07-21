import { useState } from 'react'
import api, { getRole, getErrorMessage } from '../api/client'

export default function Pharmacy() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [reservingId, setReservingId] = useState(null)
  const [message, setMessage] = useState('')
  const role = getRole()

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      const { data } = await api.get('/pharmacy/search', { params: { name: query } })
      setResults(data)
    } catch (err) {
      setError('La recherche a echoue.')
    }
  }

  async function reserve(item) {
    if (role !== 'patient') {
      setError('Connecte-toi avec un compte patient pour reserver.')
      return
    }
    setReservingId(item.id)
    try {
      await api.post('/pharmacy/reservations', { medication_id: item.id, quantity: 1, delivery_mode: 'pickup' })
      setMessage(`Reservation confirmee pour ${item.medication_name}. Tu recevras une notification de disponibilite.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Reservation impossible.'))
    } finally {
      setReservingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Pharmacie en ligne</p>
      <h1 className="font-display text-4xl font-semibold text-forest-900 mb-6">
        Compare la disponibilite entre pharmacies adherentes.
      </h1>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom du medicament ou reference..."
          className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
        />
        <button type="submit" className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition">
          Rechercher
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-4 mb-6">{message}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {results.map((item) => (
          <div key={item.id} className="rounded-xl border border-forest-100 bg-white p-5">
            <p className="font-display text-lg text-forest-900 font-semibold">{item.medication_name}</p>
            <p className="text-xs text-forest-700">Ref. {item.reference}</p>
            <p className="text-sm text-forest-700">{item.category}</p>
            <p className="text-sm text-amber-600 font-medium mt-1">{item.unit_price.toLocaleString('fr-FR')} FCFA</p>
            <p className={`text-xs mt-1 ${item.is_low_stock ? 'text-clay-600' : 'text-forest-500'}`}>
              {item.is_low_stock ? 'Stock limite' : 'En stock'}
            </p>
            <button
              onClick={() => reserve(item)}
              disabled={reservingId === item.id}
              className="mt-3 w-full rounded-full bg-amber-500 text-forest-900 py-2 font-semibold hover:bg-amber-400 transition disabled:opacity-50"
            >
              {reservingId === item.id ? 'Reservation...' : 'Reserver'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
