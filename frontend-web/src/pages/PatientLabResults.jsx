import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { LabStatusBadge, LAB_STEPS, LAB_STATUS_LABELS } from '../components/LabStatus'
import StatusStepper from '../components/StatusStepper'
import { downloadDocumentAsPdf } from '../utils/pdf'

/**
 * NOUVEAU (demande M. Faustin): "Mes analyses" devient sa propre page du
 * menu. Le patient peut VOIR le resultat sans le telecharger, le
 * telechargement PDF reste disponible en plus.
 */
export default function PatientLabResults() {
  const [labTests, setLabTests] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/lab/tests/mine')
      setLabTests(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger tes analyses.'))
    }
  }

  function downloadPdf(test) {
    downloadDocumentAsPdf({
      title: test.test_name, subtitle: "Résultat d'analyse",
      meta: [`Laboratoire: ${test.establishment_name}`, `Date: ${new Date(test.created_at).toLocaleDateString('fr-FR')}`],
      content: test.results_text || 'Résultats non encore disponibles.',
      filename: `${test.test_name.replace(/[^a-z0-9]/gi, '_')}_resultats.pdf`,
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mes analyses</h1>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {labTests.length === 0 && <p className="text-forest-700">Aucune analyse pour le moment.</p>}

      <div className="space-y-3">
        {labTests.map((t) => (
          <div key={t.id} className="rounded-xl border border-forest-100 bg-white p-4">
            {/* CORRIGE (demande explicite de M. Faustin, capture jointe:
                "est-ce qu'on peut le fermer et c'est quand on veut
                reellement voir les details que ca doit s'afficher comme
                ca" - le stepper en 5 etapes s'affichait pour CHAQUE
                analyse en permanence. Meme principe "ligne compacte +
                Ouvrir" que partout ailleurs dans le systeme). */}
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <p className="text-forest-900 font-medium">{t.test_name}</p>
                <p className="text-sm text-forest-700">{t.establishment_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <LabStatusBadge status={t.status} />
                <button
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  className="text-sm rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 hover:brightness-90 transition"
                >
                  {expandedId === t.id ? 'Fermer' : 'Ouvrir'}
                </button>
              </div>
            </div>

            {expandedId === t.id && (
              <div className="mt-3 pt-3 border-t border-forest-100">
                {t.referred_by_establishment_name && (
                  <p className="text-xs text-amber-600 mb-2">
                    Prescrit par {t.referred_by_doctor_name || 'un médecin'} ({t.referred_by_establishment_name})
                  </p>
                )}
                <StatusStepper steps={LAB_STEPS} currentValue={t.status} labels={LAB_STATUS_LABELS} />
                {t.results_text && (
                  <div className="mt-3 pt-3 border-t border-forest-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-forest-900 font-medium">Résultats</p>
                      <button onClick={() => downloadPdf(t)} className="text-xs text-amber-600 hover:underline">
                        Télécharger PDF
                      </button>
                    </div>
                    <p className="text-sm text-forest-700 whitespace-pre-wrap">{t.results_text}</p>
                  </div>
                )}
                {t.lab_technician_note && <p className="text-sm text-forest-700 italic mt-2">Note du laboratoire: {t.lab_technician_note}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
