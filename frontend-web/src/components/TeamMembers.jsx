import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const STAFF_ROLES = [
  { value: 'secretary', label: 'Secretaire' },
  { value: 'pharmacist', label: 'Pharmacien' },
  { value: 'lab_technician', label: 'Technicien laboratoire' },
]

export default function TeamMembers() {
  const [staff, setStaff] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', role: 'secretary' })
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/establishments/staff')
      setStaff(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger l'equipe."))
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/establishments/staff', form)
      setForm({ email: '', password: '', full_name: '', phone: '', role: 'secretary' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce membre de l'equipe."))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(staffId) {
    setTogglingId(staffId)
    try {
      await api.patch(`/establishments/staff/${staffId}/deactivate`)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de mettre a jour ce compte.'))
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-6">
        <input required placeholder="Nom complet" value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input required type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Telephone (optionnel)" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 bg-white">
          {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input required type="password" placeholder="Mot de passe temporaire" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 sm:col-span-2" />
        <button type="submit" disabled={saving}
          className="sm:col-span-2 rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
          {saving ? 'Ajout...' : "Ajouter ce membre de l'equipe"}
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <div className="space-y-2">
        {staff.length === 0 && <p className="text-forest-700">Aucun membre d'equipe ajoute pour le moment.</p>}
        {staff.map((s) => (
          <div key={s.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{s.full_name}</p>
              <p className="text-sm text-forest-700">
                {STAFF_ROLES.find((r) => r.value === s.role)?.label || s.role} - {s.email}
                {s.phone && ` - ${s.phone}`}
              </p>
            </div>
            <button
              onClick={() => toggleActive(s.id)}
              disabled={togglingId === s.id}
              className={`text-sm px-4 py-1.5 rounded-full font-medium transition disabled:opacity-50 ${
                s.is_active ? 'border border-clay-500 text-clay-600 hover:bg-clay-500 hover:text-white' : 'bg-forest-700 text-white hover:bg-forest-900'
              }`}
            >
              {togglingId === s.id ? '...' : s.is_active ? 'Desactiver' : 'Reactiver'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
