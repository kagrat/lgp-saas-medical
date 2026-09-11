import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande explicite de M. Faustin: "au niveau de rapport, est-ce
 * qu'on peut mettre autre chose la?"). Remplace le rapport generique
 * "revenu par departement" (sans aucun sens pour une pharmacie, qui n'a
 * pas de departements medicaux) par un rapport reellement utile: chiffre
 * d'affaires des 30 derniers jours, et lots proches de la peremption.
 */
export default function PharmacyReportsManager() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/pharmacy/reports')
      .then(({ data }) => setReport(data))
      .catch((err) => setError(getErrorMessage(err, 'Impossible de charger le rapport.')))
  }, [])

  if (error) return <p className="text-clay-600">{error}</p>
  if (!report) return <p className="text-forest-700">Chargement...</p>

  const totalRevenue = report.daily_revenue.reduce((sum, d) => sum + d.revenue, 0)

  return (
    <div>
      <p className="text-sm font-medium text-forest-900 mb-3">Chiffre d'affaires - 30 derniers jours</p>
      <div className="rounded-xl border border-forest-100 bg-white p-5 mb-8">
        <p className="font-display text-3xl font-semibold text-forest-900 mb-4">{totalRevenue.toLocaleString('fr-FR')} FCFA</p>
        {report.daily_revenue.length === 0 ? (
          <p className="text-sm text-forest-700">Aucune vente livrée sur cette période.</p>
        ) : (
          <div className="space-y-1">
            {report.daily_revenue.map((d) => (
              <div key={d.date} className="flex justify-between text-sm">
                <span className="text-forest-700">{new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="text-forest-900 font-medium">{d.revenue.toLocaleString('fr-FR')} FCFA</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm font-medium text-forest-900 mb-3">Lots proches de la péremption</p>
      {report.expiring_batches.length === 0 ? (
        <p className="text-sm text-forest-700">Aucun lot proche de la péremption actuellement.</p>
      ) : (
        <div className="space-y-2">
          {report.expiring_batches.map((b) => (
            <div key={b.id} className="rounded-xl border border-clay-300 bg-clay-500/5 p-3 flex justify-between items-center">
              <div>
                <p className="text-forest-900 font-medium text-sm">{b.medication_name} <span className="text-xs text-forest-700 font-normal">- Lot {b.lot_number}</span></p>
                <p className="text-xs text-forest-700">Expire le {new Date(b.expiration_date).toLocaleDateString('fr-FR')}</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-clay-600 text-white font-medium">{b.quantity_received} unités</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
