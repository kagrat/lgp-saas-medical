import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande explicite de M. Faustin: commande invite avec
 * ordonnance uploadee, sans compte). La commande arrive sans articles -
 * le pharmacien lit l'image, cherche chaque medicament dans SON
 * inventaire, et l'ajoute un par un avant de pouvoir proceder a la
 * verification normale (ReservationReviewForm).
 */
export default function GuestOrderPrescriptionPanel({ reservation, onItemAdded }) {
  const [stock, setStock] = useState([])
  const [query, setQuery] = useState('')
  const [addingId, setAddingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/pharmacy/stock').then(({ data }) => setStock(data)).catch(() => {})
  }, [])

  const filtered = query.trim()
    ? stock.filter((s) => s.medication_name.toLowerCase().includes(query.trim().toLowerCase()))
    : []

  async function handleAdd(medicationId) {
    setAddingId(medicationId)
    setError('')
    try {
      await api.post(`/pharmacy/reservations/${reservation.id}/items`, { medication_id: medicationId, quantity: 1 })
      if (onItemAdded) onItemAdded()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce medicament."))
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="mb-4">
      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium mb-2">
        Commande invité (sans compte) - ordonnance uploadée
      </span>
      {reservation.guest_prescription_image && (
        <img
          src={reservation.guest_prescription_image}
          alt="Ordonnance envoyée par le patient"
          className="max-w-xs rounded-lg border border-forest-100 mb-3"
        />
      )}
      {reservation.items.length === 0 && (
        <div className="rounded-xl border border-forest-100 bg-forest-50 p-3">
          <p className="text-sm text-forest-900 font-medium mb-2">Ajoute les médicaments après lecture de l'ordonnance</p>
          {error && <p className="text-clay-600 text-sm mb-2">{error}</p>}
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom du médicament..."
            className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2" />
          <div className="space-y-1">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-white rounded-lg p-2 text-sm">
                <span className="text-forest-900">{r.medication_name} <span className="text-forest-700">({r.unit_price.toLocaleString('fr-FR')} FCFA)</span></span>
                <button onClick={() => handleAdd(r.id)} disabled={addingId === r.id}
                  className="text-xs rounded-full bg-[var(--portal-accent)] text-white px-3 py-1 hover:brightness-90 transition disabled:opacity-50">
                  {addingId === r.id ? '...' : '+ Ajouter'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
