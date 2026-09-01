import { useEffect, useState } from 'react'
import { FlaskConical, Clipboard, MessageSquare, Clock } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import { LabStatsCards, RegisterTestByStaff } from '../components/LabStaffTools'
import { LAB_STATUSES, LAB_STATUS_LABELS, LAB_STEPS } from '../components/LabStatus'
import FilterTabs from '../components/FilterTabs'
import StatusStepper from '../components/StatusStepper'
import LabCatalogManager from '../components/LabCatalogManager'
import ChatWindow from '../components/ChatWindow'
import MySchedule from '../components/MySchedule'
import SidebarLayout from '../components/SidebarLayout'

export default function DesktopLabTechDashboard() {
  const [establishment, setEstablishment] = useState(null)
  const [tab, setTab] = useState('analyses')
  const [labTests, setLabTests] = useState([])
  const [labFilter, setLabFilter] = useState('requested')
  const [conversations, setConversations] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [error, setError] = useState('')
  const [labUpdateForm, setLabUpdateForm] = useState({})
  const [updatingLabId, setUpdatingLabId] = useState(null)

  useEffect(() => {
    loadEstablishment()
    loadLabTests()
  }, [])

  useEffect(() => {
    if (tab === 'messages') loadConversations()
  }, [tab])

  async function loadEstablishment() {
    try {
      const { data } = await api.get('/establishments/me')
      setEstablishment(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger les informations de l'établissement."))
    }
  }

  async function loadLabTests() {
    try {
      const { data } = await api.get('/lab/tests/establishment')
      setLabTests(data)
      const initialLabForms = {}
      data.forEach((t) => {
        initialLabForms[t.id] = { status: t.status, results_text: t.results_text || '', lab_technician_note: t.lab_technician_note || '' }
      })
      setLabUpdateForm(initialLabForms)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les analyses.'))
    }
  }

  async function loadConversations() {
    try {
      const { data } = await api.get('/messages/establishment/patients')
      setConversations(data)
      if (data.length > 0 && !selectedPatientId) setSelectedPatientId(data[0].patient_id)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les conversations.'))
    }
  }

  function updateLabForm(testId, field, value) {
    setLabUpdateForm((forms) => ({ ...forms, [testId]: { ...forms[testId], [field]: value } }))
  }

  async function submitLabUpdate(testId) {
    setUpdatingLabId(testId)
    setError('')
    try {
      const form = labUpdateForm[testId]
      await api.patch(`/lab/tests/${testId}/status`, {
        status: form.status,
        results_text: form.results_text || null,
        lab_technician_note: form.lab_technician_note || null,
      })
      await loadLabTests()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de mettre a jour cette analyse."))
    } finally {
      setUpdatingLabId(null)
    }
  }

  const tabs = [
    { id: 'analyses', label: 'Analyses', icon: FlaskConical },
    { id: 'catalog', label: 'Catalogue', icon: Clipboard },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
  ]

  const labFilterOptions = [{ value: 'all', label: 'Tous' }, ...LAB_STATUSES.map((s) => ({ value: s, label: LAB_STATUS_LABELS[s] }))]
  const filteredLabTests = labFilter === 'all' ? labTests : labTests.filter((t) => t.status === labFilter)
  const selectedConversation = conversations.find((c) => c.patient_id === selectedPatientId)

  return (
    <SidebarLayout
      portalLabel="Portail Laboratoire"
      title={establishment ? establishment.name : 'Chargement...'}
      subtitle="Ton espace technicien laboratoire."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-secondary-900"
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'analyses' && (
        <div>
          <LabStatsCards />
          <RegisterTestByStaff onRegistered={loadLabTests} />
          <FilterTabs options={labFilterOptions} active={labFilter} onChange={setLabFilter} />
          <div className="space-y-3">
            {filteredLabTests.length === 0 && <p className="text-forest-700">Aucune analyse dans cette catégorie.</p>}
            {filteredLabTests.map((t) => (
              <div key={t.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="mb-3">
                  <p className="text-forest-900 font-medium">{t.test_name}</p>
                  {t.referred_by_establishment_name && (
                    <p className="text-xs text-amber-600">
                      Orientee par {t.referred_by_doctor_name || 'un medecin'} - {t.referred_by_establishment_name}
                    </p>
                  )}
                  {t.sample_type && <p className="text-sm text-forest-700">Prelevement: {t.sample_type}</p>}
                  {t.sample_collected_at && (
                    <p className="text-xs text-forest-700 mb-3">Preleve le {new Date(t.sample_collected_at).toLocaleString('fr-FR')}</p>
                  )}
                  <StatusStepper steps={LAB_STEPS} currentValue={t.status} labels={LAB_STATUS_LABELS} />
                </div>
                <div className="grid sm:grid-cols-2 gap-2 mb-2 mt-3">
                  <select
                    value={labUpdateForm[t.id]?.status || t.status}
                    onChange={(e) => updateLabForm(t.id, 'status', e.target.value)}
                    className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white"
                  >
                    {LAB_STATUSES.map((s) => <option key={s} value={s}>{LAB_STATUS_LABELS[s]}</option>)}
                  </select>
                  <input
                    placeholder="Note (optionnel)"
                    value={labUpdateForm[t.id]?.lab_technician_note || ''}
                    onChange={(e) => updateLabForm(t.id, 'lab_technician_note', e.target.value)}
                    className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm"
                  />
                </div>
                <textarea
                  placeholder="Résultats (a remplir quand l'analyse est validee)"
                  value={labUpdateForm[t.id]?.results_text || ''}
                  onChange={(e) => updateLabForm(t.id, 'results_text', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2"
                />
                <button
                  onClick={() => submitLabUpdate(t.id)}
                  disabled={updatingLabId === t.id}
                  className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50"
                >
                  {updatingLabId === t.id ? 'Mise a jour...' : 'Mettre a jour'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'catalog' && <LabCatalogManager />}

      {tab === 'schedule' && <MySchedule />}

      {tab === 'messages' && (
        <div>
          {conversations.length === 0 ? (
            <p className="text-forest-700">Aucune conversation pour le moment.</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.patient_id}
                    onClick={() => setSelectedPatientId(c.patient_id)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      selectedPatientId === c.patient_id ? 'border-forest-700 bg-forest-50' : 'border-forest-100 bg-white hover:bg-forest-50'
                    }`}
                  >
                    <p className="text-forest-900 font-medium text-sm">{c.patient_name}</p>
                    {c.last_message && <p className="text-xs text-forest-700 truncate">{c.last_message}</p>}
                  </button>
                ))}
              </div>
              <div className="sm:col-span-2">
                {selectedConversation && (
                  <ChatWindow
                    key={selectedConversation.patient_id}
                    fetchUrl={`/messages/establishment/conversation/${selectedConversation.patient_id}`}
                    sendUrl={`/messages/establishment/conversation/${selectedConversation.patient_id}`}
                    currentSenderRole="staff"
                    title={selectedConversation.patient_name}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </SidebarLayout>
  )
}
