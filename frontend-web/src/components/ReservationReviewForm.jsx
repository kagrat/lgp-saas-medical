import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * RESTRUCTURE (panier multi-articles): verifie chaque LIGNE de la commande
 * separement (une ligne peut etre en rupture alors qu'une autre est
 * disponible), au lieu d'un seul couple quantite/prix pour toute la
 * commande.
 */
export default function ReservationReviewForm({ reservation, onDone }) {
  const [lines, setLines] = useState(
    reservation.items.map((item) => ({
      item_id: item.id,
      confirmed_quantity: item.quantity,
      confirmed_unit_price: '',
    }))
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateLine(itemId, field, value) {
    setLines((ls) => ls.map((l) => (l.item_id === itemId ? { ...l, [field]: value } : l)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.patch(`/pharmacy/reservations/${reservation.id}/review`, {
        items: lines.map((l) => ({
          item_id: l.item_id,
          confirmed_quantity: Number(l.confirmed_quantity),
          confirmed_unit_price: Number(l.confirmed_unit_price),
        })),
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
        Verifie la disponibilite et confirme quantite/prix de chaque article avant de transmettre au patient
      </p>
      <div className="space-y-2 mb-2">
        {reservation.items.map((item) => {
          const line = lines.find((l) => l.item_id === item.id)
          return (
            <div key={item.id} className="rounded-lg bg-forest-50 p-3">
              <p className="text-sm text-forest-900 font-medium mb-2">
                {item.medication_name} <span className="text-xs text-forest-700 font-normal">({item.medication_reference}) - demande: {item.quantity}</span>
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-forest-700 mb-1">Quantite confirmee</label>
                  <input type="number" min="0" required value={line.confirmed_quantity}
                    onChange={(e) => updateLine(item.id, 'confirmed_quantity', e.target.value)}
                    className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-forest-700 mb-1">Prix unitaire confirme (FCFA)</label>
                  <input type="number" min="0" step="1" required value={line.confirmed_unit_price}
                    onChange={(e) => updateLine(item.id, 'confirmed_unit_price', e.target.value)}
                    className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white" />
                </div>
              </div>
            </div>
          )
        })}
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
