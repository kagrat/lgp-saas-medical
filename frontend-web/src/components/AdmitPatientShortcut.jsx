import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande explicite de M. Faustin: "une option dans chaque
 * dossier de consultation pour admettre un patient en hospitalisation
 * sans se mettre a saisir a nouveau les informations du patient").
 * Le serveur n'exigeait deja que patient_id (aucune info personnelle a
 * ressaisir) - le manque etait purement cote ecran: pas de raccourci
 * direct depuis la consultation, obligeant a rechercher a nouveau le
 * meme patient dans l'onglet "Hospitalisations".
 */
export default function AdmitPatientShortcut({ patientId, patientName, onAdmitted }) {
  const [open, setOpen] = useState(false)
  const [departments, setDepartments] = useState([])
  const [rooms, setRooms] = useState([])
  const [form, setForm] = useState({ department_id: '', room_id: '', diagnosis: '', expected_discharge_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (open) {
      api.get('/establishments/departments').then(({ data }) => setDepartments(data)).catch(() => {})
      api.get('/services/rooms/mine').then(({ data }) => setRooms(data)).catch(() => {})
    }
  }, [open])

  async function submitAdmission(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await api.post('/admissions', {
        patient_id: patientId,
        department_id: form.department_id || null,
        room_id: form.room_id || null,
        diagnosis: form.diagnosis || null,
        expected_discharge_date: form.expected_discharge_date || null,
      })
      setMessage(`${patientName} admis(e) en hospitalisation.`)
      setForm({ department_id: '', room_id: '', diagnosis: '', expected_discharge_date: '' })
      if (onAdmitted) onAdmitted()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'admettre ce patient."))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-sm rounded-full border border-primary-700 text-primary-700 px-4 py-1.5 hover:bg-primary-50 transition">
        Admettre en hospitalisation
      </button>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-forest-100 w-full">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-medium text-forest-900">Admettre {patientName}</p>
        <button onClick={() => setOpen(false)} className="text-sm text-forest-700 hover:underline">Fermer</button>
      </div>
      {error && <p className="text-clay-600 text-sm mb-2">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-2 text-sm">{message}</p>}
      <form onSubmit={submitAdmission} className="grid sm:grid-cols-2 gap-2">
        <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="">Departement (optionnel)</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="">Chambre (optionnel)</option>
          {rooms.filter((r) => !r.is_occupied).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input placeholder="Diagnostic (optionnel)" value={form.diagnosis}
          onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
          className="sm:col-span-2 rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <div>
          <label className="block text-xs text-forest-700 mb-1">Sortie prevue (optionnel)</label>
          <input type="date" value={form.expected_discharge_date}
            onChange={(e) => setForm({ ...form, expected_discharge_date: e.target.value })}
            className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={saving}
          className="sm:col-span-2 rounded-full bg-[var(--portal-accent)] text-white py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
          {saving ? 'Admission...' : "Confirmer l'admission"}
        </button>
      </form>
    </div>
  )
}
