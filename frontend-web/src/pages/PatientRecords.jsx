import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'
import { DocumentTypeBadge } from '../components/DocumentType'
import { downloadDocumentAsPdf } from '../utils/pdf'

/**
 * NOUVEAU (demande M. Faustin): "Mon dossier patient" devient sa propre
 * page du menu - dossier de sante complet. Les commandes pharmacie ont
 * DESORMAIS LEUR PROPRE page dediee "Mes commandes pharmacie" (voir
 * PatientPharmacyOrders.jsx) - pas assez visible quand c'etait noye ici,
 * comme signale. Les ordonnances et analyses ont aussi leur propre page
 * (PatientPrescriptions.jsx et PatientLabResults.jsx) pour un acces
 * rapide, mais restent aussi visibles ici dans la vue d'ensemble complete.
 *
 * NOUVEAU: le patient peut desormais VOIR un document directement (pas
 * seulement le telecharger) - le telechargement PDF reste disponible en
 * plus, jamais obligatoire pour consulter.
 */
export default function PatientRecords() {
  const navigate = useNavigate()
  const [healthRecords, setHealthRecords] = useState([])
  const [expandedDocId, setExpandedDocId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadHealthRecords()
  }, [])

  async function loadHealthRecords() {
    try {
      const { data } = await api.get('/health-records/mine')
      setHealthRecords(data)
    } catch (err) {
      // silencieux
    }
  }

  function downloadHealthRecordPdf(doc) {
    downloadDocumentAsPdf({
      title: doc.title,
      subtitle: doc.document_type,
      meta: [
        `Médecin: ${doc.doctor_name}`,
        `Établissement: ${doc.establishment_name}`,
        `Date: ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`,
      ],
      content: doc.content,
      filename: `${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mon dossier patient</h1>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {healthRecords.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Dossier de santé</h2>
          <p className="text-sm text-forest-700 mb-4">Ordonnances, résultats et notes de consultation, tous établissements confondus.</p>
          <div className="space-y-3">
            {healthRecords.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-forest-900 font-medium">{doc.title}</p>
                  <div className="flex items-center gap-3">
                    <DocumentTypeBadge type={doc.document_type} />
                    <button onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)} className="text-xs text-primary-700 hover:underline">
                      {expandedDocId === doc.id ? 'Masquer' : 'Voir'}
                    </button>
                    <button onClick={() => downloadHealthRecordPdf(doc)} className="text-xs text-amber-600 hover:underline">
                      Télécharger PDF
                    </button>
                  </div>
                </div>
                <p className="text-xs text-forest-700">
                  {doc.doctor_name} - {doc.establishment_name} - {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                </p>
                {expandedDocId === doc.id && (
                  <p className="text-sm text-forest-700 mt-2 pt-2 border-t border-forest-100 whitespace-pre-wrap">{doc.content}</p>
                )}
                {doc.document_type === 'prescription' && doc.prescription_items && doc.prescription_items.length > 0 && (
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
                {/* NOUVEAU (demande explicite de M. Faustin: le patient
                    doit pouvoir utiliser une ordonnance d'analyses pour
                    les commander lui-meme). */}
                {doc.document_type === 'prescription' && doc.prescription_lab_items && doc.prescription_lab_items.length > 0 && (
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
        </section>
      )}


      {healthRecords.length === 0 && (
        <p className="text-forest-700">Ton dossier est vide pour le moment.</p>
      )}
    </div>
  )
}
