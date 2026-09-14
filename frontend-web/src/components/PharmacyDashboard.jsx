import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { StatusBadge } from './OrderStatus'

/**
 * NOUVEAU (demande explicite de M. Faustin): tableau de bord pharmacie en
 * tete de menu - 4 grands rectangles (meme style visuel que l'ancien
 * "Statistiques"), puis en dessous un raccourci des commandes en cours
 * de traitement (nombre limite, pas la liste complete).
 */
export default function PharmacyDashboard() {
  const [stats, setStats] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/pharmacy/stats'),
      api.get('/pharmacy/orders/summary'),
    ])
      .then(([statsRes, summaryRes]) => {
        setStats(statsRes.data)
        setSummary(summaryRes.data)
      })
      .catch((err) => setError(getErrorMessage(err, 'Impossible de charger le tableau de bord.')))
  }, [])

  if (error) return <p className="text-clay-600">{error}</p>
  if (!stats) return <p className="text-forest-700">Chargement...</p>

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatBox label="Commandes en attente" value={stats.pending_orders} highlight={stats.pending_orders > 0} />
        <StatBox label="Livraisons en cours" value={stats.deliveries_in_progress} />
        <StatBox label="Alertes de stock" value={stats.low_stock_items} highlight={stats.low_stock_items > 0} />
        <StatBox label="Chiffre d'affaires du jour" value={`${stats.revenue_today.toLocaleString('fr-FR')} FCFA`} />
      </div>

      <p className="text-sm font-medium text-forest-900 mb-3">Commandes en cours de traitement</p>
      {summary.length === 0 ? (
        <p className="text-forest-700 text-sm">Aucune commande en cours actuellement.</p>
      ) : (
        <div className="space-y-2">
          {summary.map((o) => (
            <div key={o.id} className="rounded-xl border border-forest-100 bg-white p-3 flex justify-between items-center flex-wrap gap-2">
              <div>
                <p className="text-forest-900 font-medium text-sm">{o.order_number} - {o.patient_name}</p>
                <p className="text-xs text-forest-700">{new Date(o.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="flex items-center gap-3">
                {o.total_amount !== null && <span className="text-sm text-forest-900 font-medium">{o.total_amount.toLocaleString('fr-FR')} FCFA</span>}
                <StatusBadge status={o.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'border-clay-500 bg-clay-500/5' : 'border-forest-100 bg-white'}`}>
      <p className="text-sm text-forest-700 mb-1">{label}</p>
      <p className={`font-display text-3xl font-semibold ${highlight ? 'text-clay-600' : 'text-forest-900'}`}>{value}</p>
    </div>
  )
}
