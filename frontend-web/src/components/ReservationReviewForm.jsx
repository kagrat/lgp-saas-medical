import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function ReservationReviewForm({ reservation, onDone }) {
  const [confirmedQuantity, setConfirmedQuantity] = useState(reservation.quantity)
  const [confirmedPrice, setConfirmedPrice] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.patch(`/pharmacy/reservations/${reservation.id}/review`, {
        confirmed_quantity: Number(confirmedQuantity),
        confirmed_unit_price: Number(confirmedPrice),
        note: note || null,
      })
      if (onDone) onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de transmettre cette verification.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-forest-100">
      <p className="text-sm font-medium text-forest-900 mb-2">
        Verifie la disponibilite et confirme quantite/prix avant de transmettre au patient
      </p>
      <div className="grid sm:grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-xs text-forest-700 mb-1">Quantite confirmee</label>
          <input type="number" min="1" required value={confirmedQuantity}
            onChange={(e) => setConfirmedQuantity(e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">Prix unitaire confirme (FCFA)</label>
          <input type="number" min="0" step="1" required value={confirmedPrice}
            onChange={(e) => setConfirmedPrice(e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
        </div>
      </div>
      <input placeholder="Note pour le patient (optionnel)" value={note} onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm mb-2" />
      {error && <p className="text-clay-600 text-xs mb-2">{error}</p>}
      <button type="submit" disabled={submitting}
        className="rounded-full bg-forest-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-forest-900 transition disabled:opacity-50">
        {submitting ? 'Envoi...' : 'Transmettre au patient pour confirmation'}
      </button>
    </form>
  )
}
