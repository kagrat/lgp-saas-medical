import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function PendingOverview() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/platform/pending-overview')
      .then(({ data }) => setData(data))
      .catch((err) => setError(getErrorMessage(err, 'Impossible de charger cet aperçu.')))
  }, [])

  if (error) return <p className="text-clay-600 mb-4">{error}</p>
  if (!data) return null

  const items = [
    { label: 'RDV à venir', value: data.pending_appointments },
    { label: 'Commandes en attente', value: data.pending_orders, highlight: data.pending_orders > 0 },
    { label: 'RDV annulés', value: data.cancelled_appointments },
    { label: 'Stock bas (tous établissements)', value: data.low_stock_items, highlight: data.low_stock_items > 0 },
    { label: 'Analyses en attente', value: data.pending_lab_tests },
  ]

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
      {items.map((item) => (
        <div key={item.label} className={`rounded-xl border p-4 ${item.highlight ? 'border-clay-500 bg-clay-500/5' : 'border-forest-100 bg-white'}`}>
          <p className="text-xs text-forest-700 mb-1">{item.label}</p>
          <p className={`font-display text-2xl font-semibold ${item.highlight ? 'text-clay-600' : 'text-forest-900'}`}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}
