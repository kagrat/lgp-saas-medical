import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const STAFF_ROLES = [
  { value: 'secretary', label: 'Secretaire' },
  { value: 'pharmacist', label: 'Pharmacien' },
  { value: 'lab_technician', label: 'Technicien laboratoire' },
  // NOUVEAU (gestion interne complete, demande M. Faustin):
  { value: 'nurse', label: 'Infirmier(ere)' },
  { value: 'receptionist', label: "Agent d'accueil" },
  { value: 'accountant', label: 'Comptable' },
  { value: 'hr_manager', label: 'Responsable RH' },
]

const EMPTY_FORM = { email: '', password: '', full_name: '', phone: '', role: 'secretary', department_id: '', position_title: '', hire_date: '', contract_type: '', license_number: '' }
const EMPTY_PROFILE_FORM = { full_name: '', phone: '', department_id: '', position_title: '', hire_date: '', contract_type: '', license_number: '' }

/**
 * RESTRUCTURE (gestion interne complete, demande M. Faustin): ajoute les
 * 4 nouveaux roles (infirmier, agent d'accueil, comptable, RH), le dossier
 * employe (poste, departement, embauche, contrat, licence), et la gestion
 * des departements/services organisationnels.
 */
export default function TeamMembers() {
  const [staff, setStaff] = useState([])
  const [departments, setDepartments] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE_FORM)
  const [savingProfile, setSavingProfile] = useState(false)

  const [deptForm, setDeptForm] = useState('')
  const [savingDept, setSavingDept] = useState(false)
  const [headAssignFor, setHeadAssignFor] = useState(null)

  useEffect(() => {
    load()
    loadDepartments()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/establishments/staff')
      setStaff(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger l'equipe."))
    }
  }

  async function loadDepartments() {
    try {
      const { data } = await api.get('/establishments/departments')
      setDepartments(data)
    } catch {
      // section secondaire, pas bloquant si indisponible
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/establishments/staff', { ...form, department_id: form.department_id || null, hire_date: form.hire_date || null })
      setForm(EMPTY_FORM)
      await load()
      await loadDepartments()
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

  function startEditProfile(s) {
    setEditingId(s.id)
    setProfileForm({
      full_name: s.full_name, phone: s.phone || '', department_id: s.department_id || '',
      position_title: s.position_title || '', hire_date: s.hire_date || '',
      contract_type: s.contract_type || '', license_number: s.license_number || '',
    })
  }

  async function saveProfile(staffId) {
    setSavingProfile(true)
    setError('')
    try {
      await api.patch(`/establishments/staff/${staffId}/profile`, {
        ...profileForm, department_id: profileForm.department_id || null, hire_date: profileForm.hire_date || null,
      })
      setEditingId(null)
      await load()
      await loadDepartments()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de mettre a jour le dossier employe.'))
    } finally {
      setSavingProfile(false)
    }
  }

  async function addDepartment(e) {
    e.preventDefault()
    if (!deptForm.trim()) return
    setSavingDept(true)
    setError('')
    try {
      await api.post('/establishments/departments', { name: deptForm.trim() })
      setDeptForm('')
      await loadDepartments()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de creer ce departement.'))
    } finally {
      setSavingDept(false)
    }
  }

  async function assignHead(departmentId, headUserId) {
    setError('')
    try {
      await api.patch(`/establishments/departments/${departmentId}`, { head_user_id: headUserId })
      setHeadAssignFor(null)
      await loadDepartments()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de designer ce chef de service.'))
    }
  }

  return (
    <div>
      {/* Departements / services */}
      <div className="bg-white border border-forest-100 rounded-xl p-5 mb-6">
        <p className="font-medium text-forest-900 mb-3">Departements / services</p>
        <form onSubmit={addDepartment} className="flex gap-2 mb-4">
          <input
            value={deptForm} onChange={(e) => setDeptForm(e.target.value)}
            placeholder="Nom du departement (ex: Maternite, Cardiologie...)"
            className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={savingDept} className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
            {savingDept ? '...' : 'Creer'}
          </button>
        </form>
        {departments.length === 0 && <p className="text-sm text-forest-700">Aucun departement cree pour le moment.</p>}
        <div className="space-y-2">
          {departments.map((d) => (
            <div key={d.id} className="flex justify-between items-center rounded-lg bg-forest-50 px-3 py-2">
              <div>
                <p className="text-sm text-forest-900 font-medium">{d.name}</p>
                <p className="text-xs text-forest-700">
                  {d.staff_count} membre{d.staff_count > 1 ? 's' : ''}
                  {d.head_user_name ? ` - Chef de service: ${d.head_user_name}` : ' - Aucun chef de service designe'}
                </p>
              </div>
              {headAssignFor === d.id ? (
                <select
                  autoFocus
                  onChange={(e) => assignHead(d.id, e.target.value)}
                  onBlur={() => setHeadAssignFor(null)}
                  defaultValue=""
                  className="text-xs rounded-lg border border-forest-100 px-2 py-1"
                >
                  <option value="" disabled>Choisir...</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              ) : (
                <button onClick={() => setHeadAssignFor(d.id)} className="text-xs text-amber-600 font-medium hover:underline shrink-0 ml-3">
                  Designer un chef de service
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ajout d'un membre de l'equipe */}
      <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-6">
        <input required placeholder="Nom complet" value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input required type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Téléphone (optionnel)" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 bg-white">
          {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input required type="password" placeholder="Mot de passe temporaire" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 sm:col-span-2" />

        {/* NOUVEAU: dossier employe, optionnel a la creation, completable ensuite */}
        <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 bg-white">
          <option value="">Departement (optionnel)</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input placeholder="Poste (ex: Infirmiere en chef)" value={form.position_title}
          onChange={(e) => setForm({ ...form, position_title: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <div>
          <label className="block text-xs text-forest-700 mb-1">Date d'embauche (optionnel)</label>
          <input type="date" value={form.hire_date}
            onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
            className="w-full rounded-lg border border-forest-100 px-3 py-2" />
        </div>
        <input placeholder="Type de contrat (CDI, CDD...)" value={form.contract_type}
          onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Numero de licence/diplome (optionnel)" value={form.license_number}
          onChange={(e) => setForm({ ...form, license_number: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 sm:col-span-2" />

        <button type="submit" disabled={saving}
          className="sm:col-span-2 rounded-full bg-[var(--portal-accent)] text-white py-2.5 font-medium hover:brightness-90 transition disabled:opacity-50">
          {saving ? 'Ajout...' : "Ajouter ce membre de l'equipe"}
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <div className="space-y-2">
        {staff.length === 0 && <p className="text-forest-700">Aucun membre d'équipe ajouté pour le moment.</p>}
        {staff.map((s) => (
          <div key={s.id} className="rounded-xl border border-forest-100 bg-white p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-forest-900 font-medium">{s.full_name}</p>
                <p className="text-sm text-forest-700">
                  {STAFF_ROLES.find((r) => r.value === s.role)?.label || s.role} - {s.email}
                  {s.phone && ` - ${s.phone}`}
                </p>
                <p className="text-xs text-forest-700 mt-0.5">
                  {s.department_name ? s.department_name : 'Aucun departement'}
                  {s.position_title ? ` - ${s.position_title}` : ''}
                  {s.hire_date ? ` - embauche le ${new Date(s.hire_date).toLocaleDateString('fr-FR')}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 ml-3">
                <button onClick={() => startEditProfile(s)} className="text-sm text-amber-600 font-medium hover:underline">
                  Dossier employe
                </button>
                <button
                  onClick={() => toggleActive(s.id)}
                  disabled={togglingId === s.id}
                  className={`text-sm px-4 py-1.5 rounded-full font-medium transition disabled:opacity-50 ${
                    s.is_active ? 'border border-clay-500 text-clay-600 hover:bg-clay-500 hover:text-white' : 'bg-[var(--portal-accent)] text-white hover:brightness-90'
                  }`}
                >
                  {togglingId === s.id ? '...' : s.is_active ? 'Desactiver' : 'Reactiver'}
                </button>
              </div>
            </div>

            {editingId === s.id && (
              <div className="mt-3 pt-3 border-t border-forest-100 grid sm:grid-cols-2 gap-2">
                <input placeholder="Nom complet" value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                <input placeholder="Telephone" value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                <select value={profileForm.department_id} onChange={(e) => setProfileForm({ ...profileForm, department_id: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
                  <option value="">Aucun departement</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <input placeholder="Poste" value={profileForm.position_title}
                  onChange={(e) => setProfileForm({ ...profileForm, position_title: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                <input type="date" value={profileForm.hire_date}
                  onChange={(e) => setProfileForm({ ...profileForm, hire_date: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                <input placeholder="Type de contrat" value={profileForm.contract_type}
                  onChange={(e) => setProfileForm({ ...profileForm, contract_type: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                <input placeholder="Numero de licence/diplome" value={profileForm.license_number}
                  onChange={(e) => setProfileForm({ ...profileForm, license_number: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm sm:col-span-2" />
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => saveProfile(s.id)} disabled={savingProfile}
                    className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
                    {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
