import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

const ROLE_LABELS = {
  doctor: 'Médecin', nurse: 'Infirmier(e)', secretary: 'Secrétaire',
  receptionist: 'Réceptionniste', pharmacist: 'Pharmacien(ne)',
  lab_technician: 'Technicien(ne) labo', accountant: 'Comptable',
  hr_manager: 'Ressources humaines', establishment_admin: 'Administrateur(rice)',
}

/**
 * NOUVEAU (demande explicite de M. Faustin: "un profil pour chaque
 * medecin ou chaque utilisateur au superieur droit qui renseigne ses
 * informations personnelles... visible avec son nom (photo, nom et
 * prenom et specialite) au fond superieur droit").
 */
export default function UserProfileBadge() {
  const [profile, setProfile] = useState(null)
  const [specialty, setSpecialty] = useState(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [togglingTwoFactor, setTogglingTwoFactor] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/auth/me')
      setProfile(data)
      if (data.role === 'doctor') {
        try {
          const doctorRes = await api.get('/doctors/me')
          setSpecialty(doctorRes.data.specialty)
        } catch (err) {
          // silencieux
        }
      }
    } catch (err) {
      // silencieux
    }
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const maxSize = 300
          let { width, height } = img
          if (width > height && width > maxSize) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          } else if (height > maxSize) {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          canvas.getContext('2d').drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        img.onerror = reject
        img.src = e.target.result
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const resized = await resizeImage(file)
      const { data } = await api.patch('/auth/me/photo', { photo_url: resized })
      setProfile(data)
    } catch (err) {
      // silencieux - pas critique
    } finally {
      setUploading(false)
    }
  }

  // NOUVEAU (audit de securite complet, demande explicite de M. Faustin):
  // chaque utilisateur active/desactive la double authentification
  // directement depuis son profil.
  async function toggleTwoFactor() {
    setTogglingTwoFactor(true)
    try {
      await api.patch('/auth/2fa', { enabled: !profile.two_factor_enabled })
      setProfile({ ...profile, two_factor_enabled: !profile.two_factor_enabled })
    } catch (err) {
      // silencieux - pas critique
    } finally {
      setTogglingTwoFactor(false)
    }
  }

  if (!profile) return null

  const subtitle = specialty || ROLE_LABELS[profile.role] || profile.role

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-right">
        <div>
          <p className="text-sm font-medium text-forest-900 leading-tight">{profile.full_name}</p>
          <p className="text-xs text-forest-700 leading-tight">{subtitle}</p>
        </div>
        {profile.photo_url ? (
          <img src={profile.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-forest-100" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-forest-50 flex items-center justify-center text-forest-300 text-xs shrink-0">
            {profile.full_name?.charAt(0)}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-forest-100 bg-white shadow-lg p-4 z-10">
          <p className="text-sm font-medium text-forest-900 mb-1">{profile.full_name}</p>
          <p className="text-xs text-forest-700 mb-3">{subtitle}</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full text-sm rounded-full border border-forest-300 py-1.5 hover:bg-forest-50 transition disabled:opacity-50"
          >
            {uploading ? 'Envoi...' : 'Changer la photo'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handleFileChange} className="hidden" />

          {/* CORRIGE (demande explicite de M. Faustin: le personnel doit
              pouvoir changer son mot de passe par defaut) - avant, aucun
              lien nulle part ne menait a la page de profil complete
              (changement de mot de passe inclus) depuis le tableau de
              bord du personnel. */}
          <Link to="/profil" onClick={() => setOpen(false)}
            className="block w-full text-center mt-2 text-sm rounded-full border border-forest-300 py-1.5 hover:bg-forest-50 transition">
            Voir mon profil complet
          </Link>

          <div className="mt-3 pt-3 border-t border-forest-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-forest-900">Double authentification</p>
              <button
                onClick={toggleTwoFactor}
                disabled={togglingTwoFactor}
                className={`text-xs px-2 py-1 rounded-full font-medium transition disabled:opacity-50 ${profile.two_factor_enabled ? 'bg-success-500/10 text-success-700' : 'bg-forest-50 text-forest-700'}`}
              >
                {togglingTwoFactor ? '...' : profile.two_factor_enabled ? 'Activée' : 'Désactivée'}
              </button>
            </div>
            <p className="text-xs text-forest-700">
              {profile.two_factor_enabled
                ? 'Un code te sera envoyé par e-mail à chaque connexion.'
                : 'Ajoute un code envoyé par e-mail à chaque connexion, pour plus de sécurité.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
