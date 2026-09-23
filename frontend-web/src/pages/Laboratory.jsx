import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import api, { getRole, getErrorMessage } from '../api/client'

export default function Laboratory() {
  const location = useLocation()
  // NOUVEAU (demande explicite de M. Faustin: "le docteur peut commander
  // les analyses avec ordonnance, le patient doit avoir la main pour
  // utiliser ces ordonnances pour commander ces analyses") - meme
  // principe que la pharmacie: arrive avec les analyses deja prescrites,
  // pretes a etre envoyees au laboratoire choisi.
  const incomingPrescription = location.state || {}
  const [prescriptionDocumentId] = useState(incomingPrescription.prescriptionDocumentId || null)
  const [prescriptionLabItems] = useState(incomingPrescription.prescriptionLabItems || [])
  const [city, setCity] = useState('')
  const [name, setName] = useState('')
  const [labs, setLabs] = useState([])
  const [searchError, setSearchError] = useState('')
  const [requestForm, setRequestForm] = useState({}) // lab_id -> { test_name, sample_type }
  const [requestingId, setRequestingId] = useState(null)
  // CORRIGE (demande explicite de M. Faustin, capture jointe): le
  // message d'erreur/succes s'affichait tout en haut de la page, sans
  // lien visuel avec le laboratoire precis pour lequel on a clique -
  // deroutant s'il y a plusieurs resultats. Desormais scope par
  // laboratoire.
  const [feedback, setFeedback] = useState({}) // lab_id -> { type: 'error'|'success', text }
  // CORRIGE (demande explicite de M. Faustin, capture jointe: "quand je
  // rentre dans mes analyses, c'est ce que je vois... est-ce qu'on peut
  // le fermer" - meme principe applique ici, chaque laboratoire
  // affichait son formulaire complet en permanence, tous ouverts a la
  // fois). Meme principe "ligne compacte + Ouvrir" que partout ailleurs
  // dans le systeme - un seul ouvert a la fois.
  const [expandedLabId, setExpandedLabId] = useState(null)
  const role = getRole()

  async function handleSearch(e) {
    e.preventDefault()
    setSearchError('')
    try {
      const { data } = await api.get('/lab/search', { params: { city: city || undefined, name: name || undefined } })
      setLabs(data)
    } catch (err) {
      setSearchError(getErrorMessage(err, 'La recherche a echoue.'))
    }
  }

  function updateForm(labId, field, value) {
    setRequestForm((forms) => ({ ...forms, [labId]: { ...forms[labId], [field]: value } }))
  }

  async function requestTest(lab, explicitTestName, explicitSampleType, explicitPrescriptionDocId) {
    if (role !== 'patient') {
      setFeedback((f) => ({ ...f, [lab.id]: { type: 'error', text: 'Connecte-toi avec un compte patient pour demander une analyse.' } }))
      return
    }
    const testName = explicitTestName || requestForm[lab.id]?.test_name
    const sampleType = explicitSampleType !== undefined ? explicitSampleType : requestForm[lab.id]?.sample_type
    if (!testName) {
      setFeedback((f) => ({ ...f, [lab.id]: { type: 'error', text: "Precise le nom de l'analyse souhaitee." } }))
      return
    }
    setRequestingId(lab.id)
    setFeedback((f) => ({ ...f, [lab.id]: null }))
    try {
      await api.post('/lab/tests', {
        establishment_id: lab.id,
        test_name: testName,
        sample_type: sampleType || null,
        source_document_id: explicitPrescriptionDocId || null,
      })
      setFeedback((f) => ({ ...f, [lab.id]: { type: 'success', text: `Demande envoyee a ${lab.name}. Tu peux suivre son avancement dans ton espace patient.` } }))
    } catch (err) {
      setFeedback((f) => ({ ...f, [lab.id]: { type: 'error', text: getErrorMessage(err, "Impossible d'envoyer cette demande.") } }))
    } finally {
      setRequestingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Laboratoire</p>
      <h1 className="font-display text-4xl font-semibold text-forest-900 mb-6">
        Trouve un laboratoire adhérent et demande ton analyse.
      </h1>

      <form onSubmit={handleSearch} className="grid sm:grid-cols-2 gap-3 mb-8">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nom du laboratoire (optionnel)..."
          className="rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
        />
        <div className="flex gap-3">
          <input
            value={city} onChange={(e) => setCity(e.target.value)}
            placeholder="Ville (optionnel)..."
            className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
          />
          <button type="submit" className="rounded-full bg-primary-700 text-white px-6 py-2.5 font-medium hover:bg-primary-900 transition">
            Rechercher
          </button>
        </div>
      </form>

      {searchError && <p className="text-clay-600 mb-4">{searchError}</p>}

      {/* NOUVEAU (demande explicite de M. Faustin: "vu que le docteur
          peut commander les analyses avec ordonnance, le patient doit
          avoir la main pour utiliser ces ordonnances pour commander ces
          analyses" - les donnees arrivaient deja jusqu'ici mais
          n'etaient jamais affichees ni utilisees). */}
      {prescriptionLabItems.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-6">
          <p className="text-sm font-medium text-forest-900 mb-1">Analyses prescrites par ton médecin</p>
          <p className="text-sm text-forest-700">
            {prescriptionLabItems.map((i) => i.test_name).join(', ')} - choisis un laboratoire ci-dessous, ouvre-le, puis clique sur chaque analyse pour la demander directement.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {labs.map((lab) => (
          <div key={lab.id} className="rounded-xl border border-forest-100 bg-white p-5">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <p className="font-display text-lg text-forest-900 font-semibold">{lab.name}</p>
                <p className="text-sm text-forest-700">{lab.city}{lab.address ? ` - ${lab.address}` : ''}</p>
              </div>
              <button
                onClick={() => setExpandedLabId(expandedLabId === lab.id ? null : lab.id)}
                className="text-sm rounded-full bg-primary-700 text-white px-5 py-1.5 hover:bg-primary-900 transition"
              >
                {expandedLabId === lab.id ? 'Fermer' : 'Ouvrir'}
              </button>
            </div>

            {expandedLabId === lab.id && (
              <div className="mt-4 pt-4 border-t border-forest-100">
                {feedback[lab.id] && (
                  <p className={`text-sm rounded-lg p-3 mb-3 ${feedback[lab.id].type === 'success' ? 'text-forest-900 bg-forest-50 border border-forest-300' : 'text-clay-600 bg-clay-500/5 border border-clay-300'}`}>
                    {feedback[lab.id].text}
                  </p>
                )}

                {prescriptionLabItems.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-forest-100">
                    <p className="text-sm font-medium text-forest-900 mb-2">Demander une analyse prescrite</p>
                    <div className="flex flex-wrap gap-2">
                      {prescriptionLabItems.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => requestTest(lab, item.test_name, item.sample_type, prescriptionDocumentId)}
                          disabled={requestingId === lab.id}
                          className="text-sm rounded-full bg-amber-500 text-forest-900 px-4 py-1.5 font-medium hover:bg-amber-400 transition disabled:opacity-50"
                        >
                          {item.test_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                  <input
                    placeholder="Nom de l'analyse (ex: NFS, Glycemie...)"
                    value={requestForm[lab.id]?.test_name || ''}
                    onChange={(e) => updateForm(lab.id, 'test_name', e.target.value)}
                    className="rounded-lg border border-forest-100 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Type de prelevement (optionnel)"
                    value={requestForm[lab.id]?.sample_type || ''}
                    onChange={(e) => updateForm(lab.id, 'sample_type', e.target.value)}
                    className="rounded-lg border border-forest-100 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => requestTest(lab)}
                  disabled={requestingId === lab.id}
                  className="rounded-full bg-amber-500 text-forest-900 px-5 py-2 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50"
                >
                  {requestingId === lab.id ? 'Envoi...' : 'Demander cette analyse'}
                </button>
              </div>
            )}
          </div>
        ))}
        {labs.length === 0 && <p className="text-forest-700">Lance une recherche pour voir les laboratoires disponibles.</p>}
      </div>
    </div>
  )
}
