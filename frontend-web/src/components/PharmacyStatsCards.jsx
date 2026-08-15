import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function PharmacyStatsCards() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/pharmacy/stats')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(getErrorMessage(err, 'Impossible de charger les statistiques.')))
  }, [])

  if (error) return <p className="text-clay-600 mb-4">{error}</p>
  if (!stats) return null

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatBox label="Commandes totales" value={stats.total_orders} />
      <StatBox label="Commandes ce mois" value={stats.orders_this_month} />
      <StatBox label="En attente" value={stats.pending_orders} highlight={stats.pending_orders > 0} />
      <StatBox label="Alertes stock" value={stats.low_stock_items} highlight={stats.low_stock_items > 0} />
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
