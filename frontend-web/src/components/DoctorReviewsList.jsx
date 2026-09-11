import { useEffect, useState } from 'react'
import api from '../api/client'

/**
 * NOUVEAU (demande explicite de M. Faustin): avant, ni le medecin
 * lui-meme ni l'admin d'etablissement ne pouvaient voir les avis ecrits
 * des patients - seule la note moyenne (etoiles) etait visible cote
 * etablissement, et RIEN du tout cote medecin. Les avis existaient deja
 * (visibles publiquement sur le profil du medecin, pour aider un futur
 * patient a choisir), mais jamais accessibles en tant qu'outil de suivi
 * pour le medecin ou son etablissement.
 */
export default function DoctorReviewsList({ doctorId }) {
  const [reviews, setReviews] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/doctors/${doctorId}/reviews`)
      .then(({ data }) => setReviews(data))
      .catch(() => setError('Impossible de charger les avis.'))
  }, [doctorId])

  if (error) return <p className="text-clay-600 text-sm">{error}</p>
  if (reviews === null) return <p className="text-forest-700 text-sm">Chargement...</p>
  if (reviews.length === 0) return <p className="text-forest-700 text-sm">Aucun avis pour le moment.</p>

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-lg bg-forest-50 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= r.rating ? 'text-amber-500' : 'text-forest-100'}>★</span>
              ))}
            </div>
            <span className="text-xs text-forest-700">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          {r.comment && <p className="text-sm text-forest-900">{r.comment}</p>}
          <p className="text-xs text-forest-700 mt-1">{r.patient_name}</p>
        </div>
      ))}
    </div>
  )
}
