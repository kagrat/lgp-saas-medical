import { useEffect, useState } from 'react'
import api, { getErrorMessage, getRole } from '../api/client'
import Navbar from '../components/Navbar'
import { PatientSidebarChrome } from '../components/PatientLayout'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [infoForm, setInfoForm] = useState({ full_name: '', phone: '', email: '', gender: '', residence: '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [dependents, setDependents] = useState([])
  const [dependentForm, setDependentForm] = useState({ full_name: '', relation_type: '', date_of_birth: '' })
  const [savingDependent, setSavingDependent] = useState(false)

  // NOUVEAU (demande explicite de M. Faustin: contact d'urgence AVEC
  // numero de telephone - distinct de "Dependents" ci-dessus, qui sert a
  // declarer des membres de la famille geres par ce compte, pas un
  // contact a appeler en cas d'urgence).
  const [emergencyContact, setEmergencyContact] = useState({ emergency_contact_name: '', emergency_contact_relation: '', emergency_contact_phone: '' })
  const [savingEmergencyContact, setSavingEmergencyContact] = useState(false)
  const [emergencyContactMessage, setEmergencyContactMessage] = useState('')

  const role = getRole()

  useEffect(() => {
    load()
    if (role === 'patient') {
      loadDependents()
      loadEmergencyContact()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/auth/me')
      setProfile(data)
      setInfoForm({
        full_name: data.full_name,
        phone: data.phone || '',
        email: data.email,
        gender: data.gender || '',
        residence: data.residence || '',
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger ton profil.'))
    }
  }

  async function loadDependents() {
    try {
      const { data } = await api.get('/patients/dependents/mine')
      setDependents(data)
    } catch (err) {
      // silencieux
    }
  }

  async function loadEmergencyContact() {
    try {
      const { data } = await api.get('/patients/me')
      setEmergencyContact({
        emergency_contact_name: data.emergency_contact_name || '',
        emergency_contact_relation: data.emergency_contact_relation || '',
        emergency_contact_phone: data.emergency_contact_phone || '',
      })
    } catch (err) {
      // silencieux
    }
  }

  async function submitEmergencyContact(e) {
    e.preventDefault()
    setSavingEmergencyContact(true)
    setEmergencyContactMessage('')
    setError('')
    try {
      await api.patch('/patients/me/emergency-contact', emergencyContact)
      setEmergencyContactMessage('Contact d\'urgence enregistre.')
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer le contact d'urgence."))
    } finally {
      setSavingEmergencyContact(false)
    }
  }

  async function handleInfoSubmit(e) {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setSavingInfo(true)
    try {
      const { data } = await api.patch('/auth/me', infoForm)
      setProfile(data)
      setInfoMessage('Informations mises a jour.')
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de mettre a jour tes informations.'))
    } finally {
      setSavingInfo(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setPasswordMessage('')

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordMessage('Mot de passe modifie avec succes.')
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de modifier le mot de passe.'))
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleAddDependent(e) {
    e.preventDefault()
    setError('')
    setSavingDependent(true)
    try {
      await api.post('/patients/dependents', {
        full_name: dependentForm.full_name,
        relation_type: dependentForm.relation_type,
        date_of_birth: dependentForm.date_of_birth || null,
      })
      setDependentForm({ full_name: '', relation_type: '', date_of_birth: '' })
      await loadDependents()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce proche."))
    } finally {
      setSavingDependent(false)
    }
  }

  async function handleRemoveDependent(id) {
    try {
      await api.delete(`/patients/dependents/${id}`)
      await loadDependents()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de supprimer ce proche.'))
    }
  }

  // NOUVEAU (corrige une incoherence visuelle signalee): un patient garde
  // desormais son menu lateral sur cette page, au lieu d'atterrir sur
  // l'ancienne barre du haut comme avant ce correctif. Les autres roles
  // (admin, super admin) gardent la presentation classique - ils n'ont pas
  // de menu lateral "personnel" a preserver ici.
  function withChrome(content) {
    if (role === 'patient') return <PatientSidebarChrome>{content}</PatientSidebarChrome>
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        {content}
      </div>
    )
  }

  if (!profile) {
    return withChrome(
      <div className="max-w-2xl mx-auto px-6 py-14">
        {error ? <p className="text-clay-600">{error}</p> : <p className="text-forest-700">Chargement...</p>}
      </div>
    )
  }

  return withChrome(
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mon profil</h1>

      {error && <p className="text-clay-600 mb-6">{error}</p>}

      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Mes informations</h2>
        {infoMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-3 mb-4 text-sm">{infoMessage}</p>}
        <form onSubmit={handleInfoSubmit} className="space-y-4 bg-white border border-forest-100 rounded-xl p-5">
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Nom complet</label>
            <input required value={infoForm.full_name} onChange={(e) => setInfoForm({ ...infoForm, full_name: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Téléphone</label>
            <input value={infoForm.phone} onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
              placeholder="+229 ..."
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Sexe</label>
            <select value={infoForm.gender} onChange={(e) => setInfoForm({ ...infoForm, gender: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500 bg-white">
              <option value="">Ne pas préciser</option>
              <option value="femme">Femme</option>
              <option value="homme">Homme</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Lieu de résidence</label>
            <input value={infoForm.residence} onChange={(e) => setInfoForm({ ...infoForm, residence: e.target.value })}
              placeholder="Ville, quartier..."
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Email</label>
            <input required type="email" value={infoForm.email} onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <button type="submit" disabled={savingInfo}
            className="rounded-full bg-primary-700 text-white px-6 py-2.5 font-medium hover:bg-primary-900 transition disabled:opacity-50">
            {savingInfo ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </section>

      {role === 'patient' && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-1">Personne à contacter en cas d'urgence</h2>
          <p className="text-sm text-forest-700 mb-4">Visible par le personnel médical qui te suit, pour pouvoir l'appeler si besoin.</p>
          {emergencyContactMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-3 mb-3 text-sm">{emergencyContactMessage}</p>}
          <form onSubmit={submitEmergencyContact} className="grid sm:grid-cols-3 gap-3 bg-white border border-forest-100 rounded-xl p-5">
            <input placeholder="Nom complet" value={emergencyContact.emergency_contact_name}
              onChange={(e) => setEmergencyContact({ ...emergencyContact, emergency_contact_name: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Relation (ex: Soeur, Époux)" value={emergencyContact.emergency_contact_relation}
              onChange={(e) => setEmergencyContact({ ...emergencyContact, emergency_contact_relation: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input type="tel" placeholder="Numéro de téléphone" value={emergencyContact.emergency_contact_phone}
              onChange={(e) => setEmergencyContact({ ...emergencyContact, emergency_contact_phone: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <button type="submit" disabled={savingEmergencyContact}
              className="sm:col-span-3 rounded-full bg-primary-700 text-white py-2.5 font-medium hover:bg-primary-900 transition disabled:opacity-50 justify-self-start px-6">
              {savingEmergencyContact ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </section>
      )}

      {role === 'patient' && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Mes proches</h2>
          <form onSubmit={handleAddDependent} className="grid sm:grid-cols-3 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
            <input required placeholder="Nom complet" value={dependentForm.full_name}
              onChange={(e) => setDependentForm({ ...dependentForm, full_name: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required placeholder="Relation (ex: Enfant, Conjoint)" value={dependentForm.relation_type}
              onChange={(e) => setDependentForm({ ...dependentForm, relation_type: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input type="date" value={dependentForm.date_of_birth}
              onChange={(e) => setDependentForm({ ...dependentForm, date_of_birth: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <button type="submit" disabled={savingDependent}
              className="sm:col-span-3 rounded-full bg-primary-700 text-white py-2.5 font-medium hover:bg-primary-900 transition disabled:opacity-50">
              {savingDependent ? 'Ajout...' : 'Ajouter un proche'}
            </button>
          </form>
          <div className="space-y-2">
            {dependents.length === 0 && <p className="text-forest-700 text-sm">Aucun proche ajouté pour le moment.</p>}
            {dependents.map((d) => (
              <div key={d.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
                <div>
                  <p className="text-forest-900 font-medium">{d.full_name}</p>
                  <p className="text-sm text-forest-700">
                    {d.relation_type}{d.date_of_birth ? ` - ne(e) le ${new Date(d.date_of_birth).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
                <button onClick={() => handleRemoveDependent(d.id)}
                  className="text-sm text-clay-600 hover:underline">
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Changer mon mot de passe</h2>
        {passwordMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-3 mb-4 text-sm">{passwordMessage}</p>}
        <form onSubmit={handlePasswordSubmit} className="space-y-4 bg-white border border-forest-100 rounded-xl p-5">
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Mot de passe actuel</label>
            <input required type="password" value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Nouveau mot de passe</label>
            <input required type="password" value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
            <p className="text-xs text-forest-700 mt-1">Min. 8 caractères, une majuscule, un chiffre.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Confirmer le nouveau mot de passe</label>
            <input required type="password" value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <button type="submit" disabled={savingPassword}
            className="rounded-full bg-amber-500 text-forest-900 px-6 py-2.5 font-semibold hover:bg-amber-400 transition disabled:opacity-50">
            {savingPassword ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </section>
    </div>
  )
}
