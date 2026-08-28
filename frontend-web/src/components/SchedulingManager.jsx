import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const LEAVE_STATUS_LABELS = { pending: 'En attente', approved: 'Approuve', rejected: 'Refuse' }
const LEAVE_STATUS_COLORS = {
  pending: 'bg-amber-500/10 text-amber-600', approved: 'bg-forest-500/10 text-forest-700', rejected: 'bg-clay-500/10 text-clay-600',
}

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin) - planning de
 * garde pour tout le personnel + demandes de conges. Utilise par le
 * tableau de bord RH (creation/validation) - la vue "mes gardes/mes
 * conges" cote employe reste a construire dans une prochaine iteration.
 */
export default function SchedulingManager() {
  const [staff, setStaff] = useState([])
  const [departments, setDepartments] = useState([])
  const [shifts, setShifts] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [error, setError] = useState('')

  const [shiftForm, setShiftForm] = useState({ user_id: '', department_id: '', shift_date: '', start_time: '08:00', end_time: '16:00', notes: '' })
  const [savingShift, setSavingShift] = useState(false)

  const [leaveFilter, setLeaveFilter] = useState('pending')

  useEffect(() => {
    loadReferenceData()
    loadShifts()
  }, [])

  useEffect(() => {
    loadLeaveRequests()
  }, [leaveFilter])

  async function loadReferenceData() {
    try {
      const [staffRes, deptRes] = await Promise.all([
        api.get('/establishments/staff'),
        api.get('/establishments/departments'),
      ])
      setStaff(staffRes.data)
      setDepartments(deptRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le personnel.'))
    }
  }

  async function loadShifts() {
    try {
      const { data } = await api.get('/scheduling/shifts/establishment')
      setShifts(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le planning.'))
    }
  }

  async function loadLeaveRequests() {
    try {
      const { data } = await api.get('/scheduling/leave-requests/establishment', {
        params: leaveFilter === 'all' ? {} : { leave_status: leaveFilter },
      })
      setLeaveRequests(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les demandes de conge.'))
    }
  }

  async function submitShift(e) {
    e.preventDefault()
    setSavingShift(true)
    setError('')
    try {
      await api.post('/scheduling/shifts', {
        user_id: shiftForm.user_id, department_id: shiftForm.department_id || null,
        shift_date: shiftForm.shift_date, start_time: shiftForm.start_time, end_time: shiftForm.end_time,
        notes: shiftForm.notes || null,
      })
      setShiftForm({ user_id: '', department_id: '', shift_date: '', start_time: '08:00', end_time: '16:00', notes: '' })
      await loadShifts()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de creer ce creneau.'))
    } finally {
      setSavingShift(false)
    }
  }

  async function deleteShift(id) {
    try {
      await api.delete(`/scheduling/shifts/${id}`)
      await loadShifts()
    } catch (err) {
      setError('Suppression impossible.')
    }
  }

  async function reviewLeave(id, approve) {
    setError('')
    try {
      await api.patch(`/scheduling/leave-requests/${id}/review`, { approve })
      await loadLeaveRequests()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de traiter cette demande.'))
    }
  }

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Planning</h3>
      <form onSubmit={submitShift} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <select required value={shiftForm.user_id} onChange={(e) => setShiftForm({ ...shiftForm, user_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="">Membre du personnel</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <select value={shiftForm.department_id} onChange={(e) => setShiftForm({ ...shiftForm, department_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="">Departement (optionnel)</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input required type="date" value={shiftForm.shift_date} onChange={(e) => setShiftForm({ ...shiftForm, shift_date: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input required type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
            className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm" />
          <input required type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
            className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        </div>
        <input placeholder="Notes (optionnel)" value={shiftForm.notes} onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
          className="sm:col-span-2 rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <button type="submit" disabled={savingShift}
          className="sm:col-span-2 rounded-full bg-forest-700 text-white py-2.5 text-sm font-medium hover:bg-forest-900 transition disabled:opacity-50">
          {savingShift ? 'Ajout...' : 'Ajouter ce creneau'}
        </button>
      </form>

      <div className="space-y-2 mb-8">
        {shifts.length === 0 && <p className="text-forest-700 text-sm">Aucun creneau planifie.</p>}
        {shifts.map((s) => (
          <div key={s.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{s.user_name}{s.department_name ? ` - ${s.department_name}` : ''}</p>
              <p className="text-sm text-forest-700">
                {new Date(s.shift_date).toLocaleDateString('fr-FR')} - {s.start_time.slice(0, 5)} a {s.end_time.slice(0, 5)}
                {s.notes ? ` - ${s.notes}` : ''}
              </p>
            </div>
            <button onClick={() => deleteShift(s.id)} className="text-sm text-clay-600 hover:underline">Supprimer</button>
          </div>
        ))}
      </div>

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Demandes de conge</h3>
      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f} onClick={() => setLeaveFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${leaveFilter === f ? 'bg-forest-700 text-white' : 'bg-forest-50 text-forest-700 hover:bg-forest-100'}`}
          >
            {f === 'all' ? 'Toutes' : LEAVE_STATUS_LABELS[f]}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {leaveRequests.length === 0 && <p className="text-forest-700 text-sm">Aucune demande.</p>}
        {leaveRequests.map((l) => (
          <div key={l.id} className="rounded-xl border border-forest-100 bg-white p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-forest-900 font-medium">{l.user_name}</p>
                <p className="text-sm text-forest-700">
                  Du {new Date(l.start_date).toLocaleDateString('fr-FR')} au {new Date(l.end_date).toLocaleDateString('fr-FR')}
                </p>
                {l.reason && <p className="text-sm text-forest-700 italic mt-1">{l.reason}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${LEAVE_STATUS_COLORS[l.status]}`}>
                {LEAVE_STATUS_LABELS[l.status]}
              </span>
            </div>
            {l.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => reviewLeave(l.id, true)} className="text-sm bg-forest-700 text-white px-4 py-1.5 rounded-full font-medium hover:bg-forest-900 transition">
                  Approuver
                </button>
                <button onClick={() => reviewLeave(l.id, false)} className="text-sm border border-clay-500 text-clay-600 px-4 py-1.5 rounded-full font-medium hover:bg-clay-500 hover:text-white transition">
                  Refuser
                </button>
              </div>
            )}
            {l.status !== 'pending' && l.reviewed_by_name && (
              <p className="text-xs text-forest-500 mt-2">Traite par {l.reviewed_by_name}{l.review_note ? ` - ${l.review_note}` : ''}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
