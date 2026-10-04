import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function ActivityLog() {
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/audit-logs', { params: { limit: 100 } })
      setLogs(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le journal.'))
    }
  }

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-forest-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-forest-100 text-left text-forest-700">
              <th className="px-4 py-3 font-medium">Utilisateur</th>
              <th className="px-4 py-3 font-medium">Établissement</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Détails</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-forest-50 last:border-0">
                <td className="px-4 py-3 text-forest-900">{log.user_name}</td>
                <td className="px-4 py-3 text-forest-700">{log.establishment_name || '-'}</td>
                <td className="px-4 py-3 text-forest-700">{log.action}</td>
                <td className="px-4 py-3 text-forest-700">{log.details || '-'}</td>
                <td className="px-4 py-3 text-forest-700 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-forest-700 p-4">Aucune activité enregistrée.</p>}
      </div>
    </div>
  )
}
