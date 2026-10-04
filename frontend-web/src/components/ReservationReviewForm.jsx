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
      // NOUVEAU (demande explicite de M. Faustin: "le prix des
      // medicaments vienne automatiquement... vue que ces prix ont deja
      // ete specifies dans l'inventaire") - prerempli avec le prix du
      // catalogue, mais reste modifiable si le pharmacien veut ajuster.
      confirmed_unit_price: item.catalog_unit_price ?? '',
      stock_status: 'disponible',
    }))
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateLine(itemId, field, value) {
    setLines((ls) => ls.map((l) => {
      if (l.item_id !== itemId) return l
      const updated = { ...l, [field]: value }
      // Si rupture totale choisie, la quantite confirmee tombe a 0
      // automatiquement - coherent avec ce que verra le patient.
      if (field === 'stock_status' && value === 'rupture_totale') updated.confirmed_quantity = 0
      return updated
    }))
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
          stock_status: l.stock_status,
        })),
        note: note || null,
      })
      if (onDone) onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de transmettre cette vérification.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-forest-100">
      <p className="text-sm font-medium text-forest-900 mb-2">
        Vérifie la disponibilité et confirme quantité/prix de chaque article avant de transmettre au patient
      </p>
      <div className="space-y-2 mb-2">
        {reservation.items.map((item) => {
          const line = lines.find((l) => l.item_id === item.id)
          return (
            <div key={item.id} className="rounded-lg bg-forest-50 p-3">
              <p className="text-sm text-forest-900 font-medium mb-2">
                {item.medication_name} <span className="text-xs text-forest-700 font-normal">({item.medication_reference}) - demande: {item.quantity}</span>
              </p>
              <div className="mb-2">
                <label className="block text-xs text-forest-700 mb-1">Disponibilité</label>
                <select value={line.stock_status} onChange={(e) => updateLine(item.id, 'stock_status', e.target.value)}
                  className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white">
                  <option value="disponible">Disponible (quantité demandée)</option>
                  <option value="disponible_partiel">Disponible partiellement</option>
                  <option value="rupture_temporaire">Rupture temporaire (bientôt réapprovisionné)</option>
                  <option value="rupture_totale">Rupture totale</option>
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-forest-700 mb-1">Quantité confirmée</label>
                  <input type="number" min="0" required value={line.confirmed_quantity}
                    disabled={line.stock_status === 'rupture_totale'}
                    onChange={(e) => updateLine(item.id, 'confirmed_quantity', e.target.value)}
                    className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white disabled:bg-forest-50 disabled:text-forest-500" />
                </div>
                <div>
                  <label className="block text-xs text-forest-700 mb-1">
                    Prix unitaire confirmé (FCFA)
                    {item.catalog_unit_price !== null && item.catalog_unit_price !== undefined && (
                      <span className="text-forest-500"> - prérempli depuis l'inventaire, modifiable</span>
                    )}
                  </label>
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
        className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
        {submitting ? 'Envoi...' : 'Transmettre au patient pour confirmation'}
      </button>
    </form>
  )
}
