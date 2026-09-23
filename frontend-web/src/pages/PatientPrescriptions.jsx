import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'
import { downloadDocumentAsPdf } from '../utils/pdf'

/**
 * NOUVEAU (demande M. Faustin): "Mes ordonnances" devient sa propre page
 * du menu - acces rapide, sans avoir a chercher dans le dossier complet.
 * Le patient peut VOIR le contenu sans le telecharger (bouton "Voir"), le
 * telechargement PDF reste disponible en plus.
 */
export default function PatientPrescriptions() {
  const navigate = useNavigate()
  const [prescriptions, setPrescriptions] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/health-records/mine')
      setPrescriptions(data.filter((d) => d.document_type === 'prescription'))
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger tes ordonnances.'))
    }
  }

  function downloadPdf(doc) {
    downloadDocumentAsPdf({
      title: doc.title, subtitle: 'Ordonnance',
      meta: [
        `Medecin: ${doc.doctor_name}`, `Etablissement: ${doc.establishment_name}`,
        `Date: ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`,
      ],
      content: doc.content, filename: `${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mes ordonnances</h1>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {prescriptions.length === 0 && <p className="text-forest-700">Aucune ordonnance pour le moment.</p>}

      <div className="space-y-3">
        {prescriptions.map((doc) => (
          <div key={doc.id} className="rounded-xl border border-forest-100 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-forest-900 font-medium">{doc.title}</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)} className="text-xs text-primary-700 hover:underline">
                  {expandedId === doc.id ? 'Masquer' : 'Voir'}
                </button>
                <button onClick={() => downloadPdf(doc)} className="text-xs text-amber-600 hover:underline">
                  Telecharger PDF
                </button>
              </div>
            </div>
            <p className="text-xs text-forest-700">
              {doc.doctor_name} - {doc.establishment_name} - {new Date(doc.created_at).toLocaleDateString('fr-FR')}
            </p>
            {expandedId === doc.id && (
              <p className="text-sm text-forest-700 mt-2 pt-2 border-t border-forest-100 whitespace-pre-wrap">{doc.content}</p>
            )}
            {doc.prescription_items && doc.prescription_items.length > 0 && (
              <div className="mt-3 pt-3 border-t border-forest-100">
                <p className="text-xs text-forest-700 mb-2">{doc.prescription_items.map((i) => i.medication_name).join(', ')}</p>
                <button
                  onClick={() => navigate('/pharmacie', { state: { prescriptionDocumentId: doc.id, prescriptionItems: doc.prescription_items } })}
                  className="rounded-full bg-amber-500 text-forest-900 px-4 py-1.5 text-sm font-semibold hover:bg-amber-400 transition"
                >
                  Commander en pharmacie
                </button>
              </div>
            )}
            {/* NOUVEAU (demande explicite de M. Faustin: "vu que le
                docteur peut commander les analyses avec ordonnance, le
                patient doit avoir la main pour utiliser ces ordonnances
                pour commander ces analyses"). Meme principe que la
                pharmacie, pour les analyses de laboratoire prescrites. */}
            {doc.prescription_lab_items && doc.prescription_lab_items.length > 0 && (
              <div className="mt-3 pt-3 border-t border-forest-100">
                <p className="text-xs text-forest-700 mb-2">{doc.prescription_lab_items.map((i) => i.test_name).join(', ')}</p>
                <button
                  onClick={() => navigate('/laboratoire', { state: { prescriptionDocumentId: doc.id, prescriptionLabItems: doc.prescription_lab_items } })}
                  className="rounded-full bg-amber-500 text-forest-900 px-4 py-1.5 text-sm font-semibold hover:bg-amber-400 transition"
                >
                  Commander cette analyse
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
