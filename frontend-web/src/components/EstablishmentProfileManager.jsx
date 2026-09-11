import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande explicite de M. Faustin: profil d'etablissement avec
 * nom + logo). Compresse et redimensionne l'image cote navigateur avant
 * l'envoi (max 400x400px, JPEG qualite 80%) pour rester confortablement
 * sous la limite de taille imposee par le serveur, sans jamais imposer a
 * l'utilisateur de compresser lui-meme son fichier a la main.
 */
export default function EstablishmentProfileManager({ establishment, onUpdated }) {
  const [preview, setPreview] = useState(establishment?.logo_url || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const maxSize = 400
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
    setError('')
    setMessage('')
    try {
      const resized = await resizeImage(file)
      setPreview(resized)
    } catch (err) {
      setError("Impossible de traiter cette image.")
    }
  }

  async function handleSave() {
    if (!preview || preview === establishment?.logo_url) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const { data } = await api.patch('/establishments/me/logo', { logo_url: preview })
      setMessage('Logo mis à jour.')
      if (onUpdated) onUpdated(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer ce logo."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5 max-w-md">
      <p className="text-sm font-medium text-forest-900 mb-1">Établissement</p>
      <p className="font-display text-xl text-forest-900 font-semibold mb-4">{establishment?.name}</p>

      {error && <p className="text-clay-600 text-sm mb-3">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-3 text-sm">{message}</p>}

      <div className="flex items-center gap-4 mb-4">
        {preview ? (
          <img src={preview} alt="" className="w-20 h-20 rounded-xl object-cover border border-forest-100" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-forest-50 flex items-center justify-center text-forest-300 text-xs">
            Aucun logo
          </div>
        )}
        <div>
          <label className="inline-block cursor-pointer rounded-full border border-forest-300 px-4 py-2 text-sm hover:bg-forest-50 transition">
            Choisir une image
            <input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} className="hidden" />
          </label>
          <p className="text-xs text-forest-700 mt-1">PNG ou JPEG - redimensionné automatiquement</p>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving || !preview || preview === establishment?.logo_url}
        className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
        {saving ? 'Enregistrement...' : 'Enregistrer le logo'}
      </button>
    </div>
  )
}
