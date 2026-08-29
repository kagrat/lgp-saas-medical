import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (reporting avance, dernier point du cahier des charges) -
 * rapport financier reel par departement, journal d'audit de
 * l'etablissement (auparavant reserve au Super Admin), export CSV des
 * factures (ouvrable dans Excel).
 */
export default function ReportsManager() {
  const [departmentRevenue, setDepartmentRevenue] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setError('')
    try {
      const [revenueRes, auditRes] = await Promise.all([
        api.get('/billing/summary/by-department'),
        api.get('/audit-logs/establishment'),
      ])
      setDepartmentRevenue(revenueRes.data)
      setAuditLogs(auditRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les rapports.'))
    }
  }

  async function exportInvoicesCsv() {
    setExporting(true)
    setError('')
    try {
      const response = await api.get('/billing/invoices/export.csv', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'factures.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'exporter les factures."))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display text-lg text-forest-900 font-semibold">Revenu reel par departement</h3>
        <button onClick={exportInvoicesCsv} disabled={exporting}
          className="text-sm bg-primary-700 text-white px-4 py-1.5 rounded-full font-medium hover:bg-primary-900 transition disabled:opacity-50">
          {exporting ? 'Export...' : 'Exporter les factures (CSV/Excel)'}
        </button>
      </div>
      <div className="space-y-2 mb-8">
        {departmentRevenue.length === 0 && <p className="text-forest-700 text-sm">Aucune donnee de facturation pour le moment.</p>}
        {departmentRevenue.map((d) => (
          <div key={d.department_name} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <p className="text-forest-900 font-medium">{d.department_name}</p>
            <div className="text-right text-sm">
              <p className="text-forest-900">{d.total_invoiced.toLocaleString('fr-FR')} FCFA facture</p>
              <p className="text-forest-700">{d.total_collected.toLocaleString('fr-FR')} FCFA encaisse</p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Journal d'activite de l'etablissement</h3>
      <div className="space-y-1">
        {auditLogs.length === 0 && <p className="text-forest-700 text-sm">Aucune activite enregistree.</p>}
        {auditLogs.map((log) => (
          <div key={log.id} className="rounded-lg bg-forest-50 px-3 py-2 text-sm">
            <span className="text-forest-900 font-medium">{log.user_name}</span>{' '}
            <span className="text-forest-700">- {log.action}</span>
            {log.details && <span className="text-forest-500"> - {log.details}</span>}
            <span className="text-forest-400 text-xs block">{new Date(log.created_at).toLocaleString('fr-FR')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
