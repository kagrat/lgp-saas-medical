import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const LEAVE_STATUS_LABELS = { pending: 'En attente', approved: 'Approuve', rejected: 'Refuse' }
const LEAVE_STATUS_COLORS = {
  pending: 'bg-amber-500/10 text-amber-600', approved: 'bg-success-500/10 text-success-700', rejected: 'bg-clay-500/10 text-clay-600',
}

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin) - complete la
 * fonctionnalite planning/conges cote EMPLOYE (le cote RH - creation de
 * creneaux, validation - existait deja dans SchedulingManager.jsx). Ce
 * composant est partage par tous les tableaux de bord du personnel: un
 * medecin, un infirmier, un secretaire, etc. voient tous leur PROPRE
 * planning et peuvent demander un conge de la meme facon.
 */
export default function MySchedule() {
  const [shifts, setShifts] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setError('')
    try {
      const [shiftsRes, leavesRes] = await Promise.all([
        api.get('/scheduling/shifts/mine'),
        api.get('/scheduling/leave-requests/mine'),
      ])
      setShifts(shiftsRes.data)
      setLeaveRequests(leavesRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger ton planning.'))
    }
  }

  async function submitLeaveRequest(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.post('/scheduling/leave-requests', {
        start_date: form.start_date, end_date: form.end_date, reason: form.reason || null,
      })
      setForm({ start_date: '', end_date: '', reason: '' })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer cette demande."))
    } finally {
      setSubmitting(false)
    }
  }

  const upcomingShifts = shifts.filter((s) => new Date(s.shift_date) >= new Date(new Date().toDateString()))

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Mes prochaines gardes</h3>
      <div className="space-y-2 mb-8">
        {upcomingShifts.length === 0 && <p className="text-forest-700 text-sm">Aucune garde planifiee pour le moment.</p>}
        {upcomingShifts.map((s) => (
          <div key={s.id} className="rounded-xl border border-forest-100 bg-white p-4">
            <p className="text-forest-900 font-medium">
              {new Date(s.shift_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="text-sm text-forest-700">
              {s.start_time.slice(0, 5)} a {s.end_time.slice(0, 5)}{s.department_name ? ` - ${s.department_name}` : ''}
            </p>
            {s.notes && <p className="text-sm text-forest-700 italic mt-1">{s.notes}</p>}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display text-lg text-forest-900 font-semibold">Mes demandes de conge</h3>
        <button onClick={() => setShowForm((v) => !v)} className="text-sm text-amber-600 font-medium hover:underline">
          {showForm ? 'Annuler' : 'Demander un conge'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitLeaveRequest} className="bg-white border border-forest-100 rounded-xl p-5 mb-4">
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-forest-700 mb-1">Du</label>
              <input required type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-forest-700 mb-1">Au</label>
              <input required type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
          </div>
          <textarea placeholder="Motif (optionnel)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={2} className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3" />
          <button type="submit" disabled={submitting}
            className="rounded-full bg-primary-700 text-white px-5 py-2 text-sm font-medium hover:bg-primary-900 transition disabled:opacity-50">
            {submitting ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {leaveRequests.length === 0 && <p className="text-forest-700 text-sm">Aucune demande de conge.</p>}
        {leaveRequests.map((l) => (
          <div key={l.id} className="rounded-xl border border-forest-100 bg-white p-4">
            <div className="flex justify-between items-start">
              <p className="text-sm text-forest-700">
                Du {new Date(l.start_date).toLocaleDateString('fr-FR')} au {new Date(l.end_date).toLocaleDateString('fr-FR')}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${LEAVE_STATUS_COLORS[l.status]}`}>
                {LEAVE_STATUS_LABELS[l.status]}
              </span>
            </div>
            {l.reason && <p className="text-sm text-forest-700 italic mt-1">{l.reason}</p>}
            {l.status !== 'pending' && l.reviewed_by_name && (
              <p className="text-xs text-forest-500 mt-2">Traite par {l.reviewed_by_name}{l.review_note ? ` - ${l.review_note}` : ''}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
