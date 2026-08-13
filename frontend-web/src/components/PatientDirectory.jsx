import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { AppointmentStatusBadge } from './AppointmentStatusUI'

export default function PatientDirectory() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load(query) {
    try {
      const { data } = await api.get('/patients/establishment', { params: query ? { search: query } : {} })
      setPatients(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le repertoire patients.'))
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    load(search)
  }

  async function openPatient(patient) {
    setSelectedPatient(patient)
    setDetail(null)
    setLoadingDetail(true)
    setError('')
    try {
      const { data } = await api.get(`/platform/patients/${patient.id}/detail`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger la fiche de ce patient."))
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un patient par nom..."
          className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
        />
        <button type="submit" className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition">
          Rechercher
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {selectedPatient && (
        <div className="rounded-xl border border-forest-300 bg-forest-50 p-5 mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-display text-lg text-forest-900 font-semibold">{selectedPatient.full_name}</p>
              <p className="text-sm text-forest-700">Dossier {selectedPatient.dossier_number}</p>
            </div>
            <button onClick={() => setSelectedPatient(null)} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">
              Fermer
            </button>
          </div>
          {loadingDetail && <p className="text-sm text-forest-700">Chargement...</p>}
          {detail && (
            <div>
              <p className="text-sm text-forest-700 mb-1">{detail.email}{detail.phone ? ` - ${detail.phone}` : ''}</p>
              <div className="grid sm:grid-cols-2 gap-3 my-3">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-forest-700">Commandes pharmacie</p>
                  <p className="font-display text-xl text-forest-900 font-semibold">{detail.orders_count}</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-forest-700">Analyses labo</p>
                  <p className="font-display text-xl text-forest-900 font-semibold">{detail.lab_tests_count}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-forest-900 mb-2">Rendez-vous dans cet etablissement</p>
              {detail.appointments.length === 0 && <p className="text-sm text-forest-700">Aucun rendez-vous.</p>}
              <div className="space-y-2">
                {detail.appointments.map((a) => (
                  <div key={a.id} className="flex justify-between items-center bg-white rounded-lg p-3">
                    <p className="text-sm text-forest-900">{new Date(a.scheduled_at).toLocaleString('fr-FR')}</p>
                    <AppointmentStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {patients.length === 0 && <p className="text-forest-700">Aucun patient trouve.</p>}
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => openPatient(p)}
            className="w-full text-left rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center hover:border-forest-300 transition"
          >
            <div>
              <p className="text-forest-900 font-medium">{p.full_name}</p>
              <p className="text-sm text-forest-700">
                Dossier {p.dossier_number} - {p.email}{p.phone ? ` - ${p.phone}` : ''}
              </p>
            </div>
            {p.last_visit && (
              <p className="text-xs text-forest-700">
                Derniere visite: {new Date(p.last_visit).toLocaleDateString('fr-FR')}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
