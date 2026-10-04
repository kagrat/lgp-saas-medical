import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const STATUS_LABELS = { issued: 'À payer', partially_paid: 'Partiellement payée', paid: 'Payée', cancelled: 'Annulée' }
const STATUS_COLORS = {
  issued: 'bg-amber-500/10 text-amber-600', partially_paid: 'bg-amber-500/10 text-amber-600',
  paid: 'bg-success-500/10 text-success-700', cancelled: 'bg-clay-500/10 text-clay-600',
}

/**
 * NOUVEAU (facturation reelle): le patient voit ses vraies factures, tous
 * etablissements confondus - plus une simple estimation.
 */
export default function MyInvoices() {
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/billing/invoices/mine')
        setInvoices(data)
      } catch (err) {
        setError(getErrorMessage(err, 'Impossible de charger tes factures.'))
      }
    })()
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Mon espace</p>
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mes factures</h1>

      {error && <p className="text-clay-600 mb-6">{error}</p>}

      <div className="space-y-2">
        {invoices.length === 0 && <p className="text-forest-700">Aucune facture pour le moment.</p>}
        {invoices.map((inv) => (
          <div key={inv.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{inv.invoice_number}</p>
              <p className="text-sm text-forest-700">{new Date(inv.issued_at).toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="text-right">
              <p className="text-forest-900 font-medium">{inv.total_amount.toLocaleString('fr-FR')} FCFA</p>
              {inv.balance_due > 0 && inv.status !== 'cancelled' && (
                <p className="text-xs text-clay-600">Reste du: {inv.balance_due.toLocaleString('fr-FR')} FCFA</p>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status]}`}>
                {STATUS_LABELS[inv.status] || inv.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
