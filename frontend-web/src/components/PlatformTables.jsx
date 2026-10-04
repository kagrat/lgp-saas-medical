import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { AppointmentStatusBadge } from './AppointmentStatusUI'
import { StatusBadge } from './OrderStatus'
import FilterTabs from './FilterTabs'

const TABLES = [
  { value: 'appointments', label: 'Rendez-vous' },
  { value: 'orders', label: 'Commandes' },
  { value: 'doctors', label: 'Médecins' },
  { value: 'pharmacies', label: 'Pharmacies' },
  { value: 'laboratories', label: 'Laboratoires' },
]

export default function PlatformTables() {
  const [table, setTable] = useState('appointments')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    load(table)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  async function load(t) {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/platform/${t}`)
      setRows(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger cette table.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <FilterTabs options={TABLES} active={table} onChange={setTable} />

      {error && <p className="text-clay-600 mb-4">{error}</p>}
      {loading && <p className="text-forest-700 mb-4">Chargement...</p>}

      {!loading && table === 'appointments' && (
        <TableView
          rows={rows}
          columns={['Patient', 'Médecin', 'Établissement', 'Date', 'Statut']}
          render={(r) => [
            r.patient_name, r.doctor_name, r.establishment_name,
            new Date(r.scheduled_at).toLocaleString('fr-FR'),
            <AppointmentStatusBadge status={r.status} />,
          ]}
        />
      )}

      {!loading && table === 'orders' && (
        <TableView
          rows={rows}
          columns={['Patient', 'Médicament', 'Établissement', 'Quantité', 'Statut']}
          render={(r) => [r.patient_name, r.medication_name, r.establishment_name, r.quantity, <StatusBadge status={r.status} />]}
        />
      )}

      {!loading && table === 'doctors' && (
        <TableView
          rows={rows}
          columns={['Nom', 'Spécialité', 'Établissement', 'Statut']}
          render={(r) => [r.full_name, r.specialty, r.establishment_name, r.is_active ? 'Actif' : 'Inactif']}
        />
      )}

      {!loading && (table === 'pharmacies' || table === 'laboratories') && (
        <TableView
          rows={rows}
          columns={['Nom', 'Ville', 'Admin', 'Abonnement', 'Statut']}
          render={(r) => [r.name, r.city, r.admin_email || '-', r.subscription_status, r.is_active ? 'Actif' : 'Suspendu']}
        />
      )}
    </div>
  )
}

function TableView({ rows, columns, render }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-forest-100 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-forest-100 text-left text-forest-700">
            {columns.map((c) => <th key={c} className="px-4 py-3 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id || idx} className="border-b border-forest-50 last:border-0">
              {render(r).map((cell, i) => <td key={i} className="px-4 py-3 text-forest-900">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="text-forest-700 p-4">Aucune donnée.</p>}
    </div>
  )
}
