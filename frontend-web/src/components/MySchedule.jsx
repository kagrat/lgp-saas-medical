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
const SHIFTS_COLLAPSED_LIMIT = 5

export default function MySchedule() {
  const [shifts, setShifts] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [error, setError] = useState('')
  const [shiftsExpanded, setShiftsExpanded] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)

  // NOUVEAU (demande explicite de M. Faustin: "en attendant" que DRH/ETS
  // gerent entierement la disponibilite, "ajouter l'option de
  // programmation au niveau de mon planning pour permettre aux medecins
  // de se programmer ses gardes" - sur une periode d'au moins 1 mois).
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [shiftForm, setShiftForm] = useState({ shift_date: '', start_time: '08:00', end_time: '16:00', notes: '' })
  const [savingShift, setSavingShift] = useState(false)
  const [shiftMessage, setShiftMessage] = useState('')

  const [showQuickSetup, setShowQuickSetup] = useState(false)
  const [quickSetup, setQuickSetup] = useState({
    days: [], from_date: '', to_date: '', start_time: '08:00', end_time: '16:00',
  })
  const [savingQuickSetup, setSavingQuickSetup] = useState(false)
  const [quickSetupMessage, setQuickSetupMessage] = useState('')

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

  async function submitShift(e) {
    e.preventDefault()
    setSavingShift(true)
    setShiftMessage('')
    setError('')
    try {
      await api.post('/scheduling/shifts/mine', {
        shift_date: shiftForm.shift_date, start_time: shiftForm.start_time,
        end_time: shiftForm.end_time, notes: shiftForm.notes || null,
      })
      setShiftMessage('Garde programmee.')
      setShiftForm({ shift_date: '', start_time: '08:00', end_time: '16:00', notes: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de programmer cette garde.'))
    } finally {
      setSavingShift(false)
    }
  }

  function toggleQuickDay(dayIndex) {
    setQuickSetup((q) => ({
      ...q,
      days: q.days.includes(dayIndex) ? q.days.filter((d) => d !== dayIndex) : [...q.days, dayIndex],
    }))
  }

  // NOUVEAU (demande explicite de M. Faustin: "la programmation doit
  // pouvoir se faire sur une periode de 1 mois") - au lieu d'ajouter
  // chaque garde une par une, choisis les jours de la semaine et une
  // plage de dates (jusqu'a 1 mois ou plus): toutes les gardes
  // correspondantes sont creees en une seule action.
  async function submitQuickSetup(e) {
    e.preventDefault()
    if (quickSetup.days.length === 0 || !quickSetup.from_date || !quickSetup.to_date) return
    setSavingQuickSetup(true)
    setQuickSetupMessage('')
    setError('')
    try {
      const start = new Date(quickSetup.from_date)
      const end = new Date(quickSetup.to_date)
      const dates = []
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (quickSetup.days.includes(d.getDay())) {
          dates.push(new Date(d).toISOString().slice(0, 10))
        }
      }
      for (const shift_date of dates) {
        await api.post('/scheduling/shifts/mine', {
          shift_date, start_time: quickSetup.start_time, end_time: quickSetup.end_time,
        })
      }
      setQuickSetupMessage(`${dates.length} garde(s) programmee(s).`)
      setQuickSetup({ days: [], from_date: '', to_date: '', start_time: '08:00', end_time: '16:00' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'appliquer cette programmation."))
    } finally {
      setSavingQuickSetup(false)
    }
  }

  const upcomingShifts = shifts.filter((s) => new Date(s.shift_date) >= new Date(new Date().toDateString()))

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {/* NOUVEAU (demande explicite de M. Faustin - solution temporaire
          "en attendant" que DRH/ETS gerent entierement la disponibilite). */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setShowShiftForm((v) => !v); setShowQuickSetup(false) }}
          className="text-sm rounded-full border border-forest-300 px-4 py-1.5 hover:bg-forest-50 transition">
          {showShiftForm ? 'Fermer' : '+ Programmer une garde'}
        </button>
        <button onClick={() => { setShowQuickSetup((v) => !v); setShowShiftForm(false) }}
          className="text-sm rounded-full border border-forest-300 px-4 py-1.5 hover:bg-forest-50 transition">
          {showQuickSetup ? 'Fermer' : '+ Programmer sur une periode'}
        </button>
      </div>

      {showShiftForm && (
        <form onSubmit={submitShift} className="bg-white border border-forest-100 rounded-xl p-5 mb-4">
          {shiftMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-3 text-sm">{shiftMessage}</p>}
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-forest-700 mb-1">Date</label>
              <input required type="date" value={shiftForm.shift_date} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setShiftForm({ ...shiftForm, shift_date: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-forest-700 mb-1">Début</label>
              <input required type="time" value={shiftForm.start_time}
                onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-forest-700 mb-1">Fin</label>
              <input required type="time" value={shiftForm.end_time}
                onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
          </div>
          <input placeholder="Notes (optionnel)" value={shiftForm.notes}
            onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
            className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3" />
          <button type="submit" disabled={savingShift}
            className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
            {savingShift ? 'Enregistrement...' : 'Programmer cette garde'}
          </button>
        </form>
      )}

      {showQuickSetup && (
        <form onSubmit={submitQuickSetup} className="bg-white border border-forest-100 rounded-xl p-5 mb-4">
          {quickSetupMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-3 text-sm">{quickSetupMessage}</p>}
          <p className="text-sm text-forest-700 mb-2">Choisis les jours de la semaine, une plage de dates (au moins 1 mois conseille), et l'horaire.</p>
          <div className="flex gap-1 mb-3 flex-wrap">
            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((label, idx) => (
              <button key={idx} type="button" onClick={() => toggleQuickDay(idx)}
                className={`text-sm px-3 py-1.5 rounded-full border transition ${quickSetup.days.includes(idx) ? 'bg-[var(--portal-accent)] text-white border-transparent' : 'border-forest-300 text-forest-700 hover:bg-forest-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs text-forest-700 mb-1">Du</label>
              <input required type="date" value={quickSetup.from_date} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setQuickSetup({ ...quickSetup, from_date: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-forest-700 mb-1">Au</label>
              <input required type="date" value={quickSetup.to_date} min={quickSetup.from_date || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setQuickSetup({ ...quickSetup, to_date: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-forest-700 mb-1">Début</label>
              <input required type="time" value={quickSetup.start_time}
                onChange={(e) => setQuickSetup({ ...quickSetup, start_time: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-forest-700 mb-1">Fin</label>
              <input required type="time" value={quickSetup.end_time}
                onChange={(e) => setQuickSetup({ ...quickSetup, end_time: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={savingQuickSetup || quickSetup.days.length === 0}
            className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
            {savingQuickSetup ? 'Application...' : 'Programmer toutes ces gardes'}
          </button>
        </form>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-forest-900 font-semibold">Mes prochaines gardes</h3>
        {/* CORRIGE (demande explicite de M. Faustin, capture jointe: "il
            faut pouvoir reduire lorsque la programmation est deja
            effectuee sur plusieurs semaines") - avant, TOUTES les gardes
            s'affichaient d'un coup (une programmation sur 1 mois pouvant
            en generer des dizaines), rendant la page interminable. */}
        {upcomingShifts.length > SHIFTS_COLLAPSED_LIMIT && (
          <button onClick={() => setShiftsExpanded((v) => !v)} className="text-sm text-forest-700 font-medium hover:underline">
            {shiftsExpanded ? 'Réduire' : `Voir toutes les gardes (${upcomingShifts.length})`}
          </button>
        )}
      </div>
      <div className="space-y-2 mb-8">
        {upcomingShifts.length === 0 && <p className="text-forest-700 text-sm">Aucune garde planifiee pour le moment.</p>}
        {(shiftsExpanded ? upcomingShifts : upcomingShifts.slice(0, SHIFTS_COLLAPSED_LIMIT)).map((s) => (
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
            className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
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
