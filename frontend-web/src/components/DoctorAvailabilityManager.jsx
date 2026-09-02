import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { DAYS_OF_WEEK } from '../constants'

/**
 * NOUVEAU (demande M. Faustin: verifier et brancher les fonctionnalites
 * deja construites cote serveur mais jamais utilisees). Extrait de
 * EstablishmentAdmin.jsx pour etre reutilisable - l'admin d'etablissement
 * ET le medecin lui-meme ont tous deux le droit cote serveur de gerer
 * ceci (meme regle deja en place pour les disponibilites), mais seul
 * l'admin y avait acces avant ce correctif.
 *
 * Ajoute aussi la gestion des ABSENCES (conges), qui existait deja cote
 * serveur (creation) mais n'avait ni lecture ni suppression, et n'etait
 * appelee par AUCUNE interface - le medecin apparaissait donc toujours
 * disponible meme en conge.
 */
export default function DoctorAvailabilityManager({ doctorId }) {
  const [availabilities, setAvailabilities] = useState([])
  const [absences, setAbsences] = useState([])
  const [error, setError] = useState('')
  const [availForm, setAvailForm] = useState({ day_of_week: 0, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 30 })
  const [absenceForm, setAbsenceForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [savingAvail, setSavingAvail] = useState(false)
  const [savingAbsence, setSavingAbsence] = useState(false)

  useEffect(() => {
    load()
  }, [doctorId])

  async function load() {
    try {
      const [availRes, absenceRes] = await Promise.all([
        api.get(`/doctors/${doctorId}/availabilities`),
        api.get(`/doctors/${doctorId}/absences`),
      ])
      setAvailabilities(availRes.data)
      setAbsences(absenceRes.data)
    } catch (err) {
      setError('Impossible de charger les disponibilités.')
    }
  }

  async function handleAddAvailability(e) {
    e.preventDefault()
    setError('')
    setSavingAvail(true)
    try {
      await api.post(`/doctors/${doctorId}/availabilities`, {
        day_of_week: Number(availForm.day_of_week),
        start_time: availForm.start_time,
        end_time: availForm.end_time,
        slot_duration_minutes: Number(availForm.slot_duration_minutes),
      })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce créneau. Vérifie que l'heure de fin est bien apres l'heure de debut."))
    } finally {
      setSavingAvail(false)
    }
  }

  async function handleDeleteAvailability(availabilityId) {
    try {
      await api.delete(`/doctors/${doctorId}/availabilities/${availabilityId}`)
      await load()
    } catch (err) {
      setError('Suppression impossible.')
    }
  }

  async function handleAddAbsence(e) {
    e.preventDefault()
    setError('')
    if (!absenceForm.start_date || !absenceForm.end_date) {
      setError('Precise une date de debut et de fin.')
      return
    }
    setSavingAbsence(true)
    try {
      await api.post(`/doctors/${doctorId}/absences`, {
        start_date: absenceForm.start_date,
        end_date: absenceForm.end_date,
        reason: absenceForm.reason || null,
      })
      setAbsenceForm({ start_date: '', end_date: '', reason: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer cette absence. Vérifie que la date de fin est bien apres la date de debut."))
    } finally {
      setSavingAbsence(false)
    }
  }

  async function handleDeleteAbsence(absenceId) {
    try {
      await api.delete(`/doctors/${doctorId}/absences/${absenceId}`)
      await load()
    } catch (err) {
      setError('Suppression impossible.')
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-forest-100">
      {error && <p className="text-clay-600 text-sm mb-3">{error}</p>}

      <p className="text-sm font-medium text-forest-900 mb-3">
        Disponibilités hebdomadaires (se repetent chaque semaine)
      </p>

      <form onSubmit={handleAddAvailability} className="flex flex-wrap gap-2 items-end mb-4">
        <div>
          <label className="block text-xs text-forest-700 mb-1">Jour</label>
          <select value={availForm.day_of_week} onChange={(e) => setAvailForm({ ...availForm, day_of_week: e.target.value })}
            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm bg-white">
            {DAYS_OF_WEEK.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">De</label>
          <input type="time" value={availForm.start_time} onChange={(e) => setAvailForm({ ...availForm, start_time: e.target.value })}
            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">A</label>
          <input type="time" value={availForm.end_time} onChange={(e) => setAvailForm({ ...availForm, end_time: e.target.value })}
            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">Duree/RDV (min)</label>
          <input type="number" min="5" step="5" value={availForm.slot_duration_minutes}
            onChange={(e) => setAvailForm({ ...availForm, slot_duration_minutes: e.target.value })}
            className="w-24 rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={savingAvail}
          className="rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 text-sm font-semibold hover:brightness-90 transition disabled:opacity-50">
          {savingAvail ? 'Ajout...' : 'Ajouter ce creneau'}
        </button>
      </form>

      {availabilities.length === 0 ? (
        <p className="text-sm text-forest-700 mb-6">Aucune disponibilité enregistrée pour ce médecin.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-6">
          {availabilities.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-full bg-forest-50 px-3 py-1.5 text-sm text-forest-900">
              <span>
                {DAYS_OF_WEEK.find((d) => d.value === a.day_of_week)?.label} {a.start_time.slice(0, 5)}-{a.end_time.slice(0, 5)}
              </span>
              <button onClick={() => handleDeleteAvailability(a.id)} className="text-clay-600 hover:text-clay-500 font-bold" aria-label="Supprimer ce créneau">
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* NOUVEAU: gestion des conges/absences - le medecin n'apparait plus
          disponible aux patients pour les dates concernees (deja applique
          automatiquement par le moteur de calcul des creneaux). */}
      <p className="text-sm font-medium text-forest-900 mb-3">Congés et absences ponctuelles</p>

      <form onSubmit={handleAddAbsence} className="flex flex-wrap gap-2 items-end mb-4">
        <div>
          <label className="block text-xs text-forest-700 mb-1">Du</label>
          <input type="date" value={absenceForm.start_date} onChange={(e) => setAbsenceForm({ ...absenceForm, start_date: e.target.value })}
            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">Au</label>
          <input type="date" value={absenceForm.end_date} onChange={(e) => setAbsenceForm({ ...absenceForm, end_date: e.target.value })}
            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs text-forest-700 mb-1">Motif (optionnel)</label>
          <input placeholder="Ex: Congé annuel, formation..." value={absenceForm.reason}
            onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
            className="w-full rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={savingAbsence}
          className="rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 text-sm font-semibold hover:brightness-90 transition disabled:opacity-50">
          {savingAbsence ? 'Ajout...' : 'Declarer une absence'}
        </button>
      </form>

      {absences.length === 0 ? (
        <p className="text-sm text-forest-700">Aucune absence enregistrée.</p>
      ) : (
        <div className="space-y-2">
          {absences.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg bg-forest-50 px-3 py-2 text-sm text-forest-900">
              <span>
                Du {new Date(a.start_date).toLocaleDateString('fr-FR')} au {new Date(a.end_date).toLocaleDateString('fr-FR')}
                {a.reason && ` - ${a.reason}`}
              </span>
              <button onClick={() => handleDeleteAbsence(a.id)} className="text-clay-600 hover:text-clay-500 font-bold ml-3" aria-label="Supprimer cette absence">
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
