import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import TeamMembers from '../components/TeamMembers'
import SchedulingManager from '../components/SchedulingManager'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin): espace du
 * responsable RH. Reutilise TeamMembers.jsx (gestion du personnel et des
 * departements) - le Responsable RH a desormais les memes permissions que
 * l'admin d'etablissement sur ces deux points cote serveur.
 */
export default function DesktopHRDashboard() {
  const [establishment, setEstablishment] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('team')

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/establishments/me')
        setEstablishment(data)
      } catch (err) {
        setError(getErrorMessage(err, "Impossible de charger les informations de l'etablissement."))
      }
    })()
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Ressources humaines</p>
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">
        {establishment ? establishment.name : 'Gestion du personnel'}
      </h1>
      <p className="text-forest-700 mb-8">
        Gere les departements, les membres de l'equipe, leur dossier employe, le planning et les conges.
      </p>

      <div className="flex gap-2 mb-8 border-b border-forest-100">
        {[{ id: 'team', label: 'Equipe' }, { id: 'scheduling', label: 'Planning & Conges' }].map((t) => (
          <button
            key={t.id} onClick={() => { setTab(t.id); setError('') }}
            className={`px-4 py-2 font-medium border-b-2 -mb-px transition ${tab === t.id ? 'border-amber-500 text-forest-900' : 'border-transparent text-forest-700 hover:text-forest-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'team' && <TeamMembers />}
      {tab === 'scheduling' && <SchedulingManager />}
    </div>
  )
}
