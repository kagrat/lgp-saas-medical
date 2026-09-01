import { useEffect, useState } from 'react'
import { Receipt, Clock } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import MySchedule from '../components/MySchedule'
import SidebarLayout from '../components/SidebarLayout'

const STATUS_LABELS = { issued: 'Emise', partially_paid: 'Partiellement payee', paid: 'Payee', cancelled: 'Annulee' }
const STATUS_COLORS = {
  issued: 'bg-amber-500/10 text-amber-600', partially_paid: 'bg-amber-500/10 text-amber-600',
  paid: 'bg-success-500/10 text-success-700', cancelled: 'bg-clay-500/10 text-clay-600',
}

/**
 * NOUVEAU (facturation reelle, chantier prioritaire du cahier des
 * charges): espace comptable reel - creation de factures, encaissement,
 * suivi des impayes. Remplace le placeholder "en construction".
 */
export default function DesktopAccountantDashboard() {
  const [tab, setTab] = useState('billing')
  const [summary, setSummary] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [lineItems, setLineItems] = useState([{ description: '', quantity: 1, unit_price: '' }])
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', reference: '' })
  const [recordingPayment, setRecordingPayment] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setError('')
    try {
      const [summaryRes, invoicesRes] = await Promise.all([
        api.get('/billing/summary'),
        api.get('/billing/invoices/establishment'),
      ])
      setSummary(summaryRes.data)
      setInvoices(invoicesRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les donnees de facturation.'))
    }
  }

  async function searchPatients(e) {
    e.preventDefault()
    try {
      const { data } = await api.get('/patients/establishment', { params: { search: patientQuery } })
      setPatientResults(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Recherche impossible.'))
    }
  }

  function pickPatient(p) {
    setSelectedPatient(p)
    setPatientResults([])
    setPatientQuery(p.full_name)
  }

  function updateLineItem(idx, field, value) {
    setLineItems((items) => items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function addLineItem() {
    setLineItems((items) => [...items, { description: '', quantity: 1, unit_price: '' }])
  }
  function removeLineItem(idx) {
    setLineItems((items) => items.filter((_, i) => i !== idx))
  }

  const draftTotal = lineItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)

  async function submitInvoice(e) {
    e.preventDefault()
    if (!selectedPatient) {
      setError('Choisis un patient dans les resultats de recherche.')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.post('/billing/invoices', {
        patient_id: selectedPatient.id,
        line_items: lineItems
          .filter((it) => it.description && it.unit_price)
          .map((it) => ({ description: it.description, quantity: Number(it.quantity) || 1, unit_price: Number(it.unit_price) })),
        notes: notes || null,
      })
      setShowCreateForm(false)
      setSelectedPatient(null)
      setPatientQuery('')
      setLineItems([{ description: '', quantity: 1, unit_price: '' }])
      setNotes('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de creer cette facture."))
    } finally {
      setCreating(false)
    }
  }

  async function openInvoice(id) {
    setSelectedId(id)
    setDetail(null)
    setLoadingDetail(true)
    setPaymentForm({ amount: '', payment_method: 'cash', reference: '' })
    try {
      const { data } = await api.get(`/billing/invoices/${id}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger cette facture.'))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function submitPayment() {
    setRecordingPayment(true)
    setError('')
    try {
      await api.post(`/billing/invoices/${selectedId}/payments`, {
        amount: Number(paymentForm.amount), payment_method: paymentForm.payment_method,
        reference: paymentForm.reference || null,
      })
      setPaymentForm({ amount: '', payment_method: 'cash', reference: '' })
      const { data } = await api.get(`/billing/invoices/${selectedId}`)
      setDetail(data)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer ce paiement."))
    } finally {
      setRecordingPayment(false)
    }
  }

  const tabs = [
    { id: 'billing', label: 'Facturation', icon: Receipt },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Comptabilité"
      title="Facturation"
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-primary-500"
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'schedule' && <MySchedule />}

      {tab === 'billing' && (
        <div>
      {summary && (
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-forest-100 bg-white p-4">
            <p className="text-xs text-forest-700 mb-1">Total facture</p>
            <p className="text-xl font-semibold text-forest-900">{summary.total_invoiced.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div className="rounded-xl border border-forest-100 bg-white p-4">
            <p className="text-xs text-forest-700 mb-1">Total encaisse</p>
            <p className="text-xl font-semibold text-forest-900">{summary.total_collected.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div className="rounded-xl border border-forest-100 bg-white p-4">
            <p className="text-xs text-forest-700 mb-1">Reste a encaisser</p>
            <p className="text-xl font-semibold text-clay-600">{summary.total_outstanding.toLocaleString('fr-FR')} FCFA</p>
            <p className="text-xs text-forest-700 mt-1">{summary.unpaid_invoice_count} facture(s) non soldee(s)</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-forest-700 text-sm">Factures de l'etablissement.</p>
        <button onClick={() => setShowCreateForm((v) => !v)} className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition">
          {showCreateForm ? 'Annuler' : 'Nouvelle facture'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={submitInvoice} className="bg-white border border-forest-100 rounded-xl p-5 mb-6">
          <p className="text-sm font-medium text-forest-900 mb-2">Patient</p>
          <form onSubmit={searchPatients} className="flex gap-2 mb-3">
            <input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Nom du patient..."
              className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            <button type="submit" className="rounded-full bg-[var(--portal-accent)] text-white px-4 py-2 text-sm font-medium hover:brightness-90 transition">Chercher</button>
          </form>
          {patientResults.length > 0 && (
            <div className="space-y-1 mb-3">
              {patientResults.map((p) => (
                <button type="button" key={p.id} onClick={() => pickPatient(p)}
                  className="block w-full text-left text-sm rounded-lg border border-forest-100 p-2 hover:border-forest-300 transition">
                  {p.full_name} - dossier {p.dossier_number}
                </button>
              ))}
            </div>
          )}
          {selectedPatient && <p className="text-sm text-forest-900 font-medium mb-3">Patient choisi: {selectedPatient.full_name}</p>}

          <p className="text-sm font-medium text-forest-900 mb-2">Lignes de facture</p>
          <div className="space-y-2 mb-3">
            {lineItems.map((it, idx) => (
              <div key={idx} className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <input placeholder="Description (ex: Consultation)" value={it.description}
                  onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                <input type="number" min="1" placeholder="Qte" value={it.quantity}
                  onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                  className="w-20 rounded-lg border border-forest-100 px-2 py-2 text-sm" />
                <input type="number" min="0" placeholder="Prix unit." value={it.unit_price}
                  onChange={(e) => updateLineItem(idx, 'unit_price', e.target.value)}
                  className="w-28 rounded-lg border border-forest-100 px-2 py-2 text-sm" />
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLineItem(idx)} className="text-xs text-clay-600 hover:underline">Retirer</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addLineItem} className="text-sm text-amber-600 font-medium hover:underline mb-3">
            + Ajouter une ligne
          </button>

          <p className="text-forest-900 font-semibold mb-3">Total: {draftTotal.toLocaleString('fr-FR')} FCFA</p>

          <textarea placeholder="Notes (optionnel)" value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={2} className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3" />

          <button type="submit" disabled={creating}
            className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-semibold hover:brightness-90 transition disabled:opacity-50">
            {creating ? 'Creation...' : 'Creer la facture'}
          </button>
        </form>
      )}

      {selectedId && (
        <div className="rounded-xl border border-forest-300 bg-forest-50 p-5 mb-6">
          {loadingDetail && <p className="text-sm text-forest-700">Chargement...</p>}
          {detail && (
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-display text-lg text-forest-900 font-semibold">{detail.invoice_number}</p>
                  <p className="text-sm text-forest-700">{detail.patient_name}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[detail.status]}`}>
                    {STATUS_LABELS[detail.status] || detail.status}
                  </span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">Fermer</button>
              </div>

              <div className="bg-white rounded-lg p-4 mb-4">
                {detail.line_items.map((li) => (
                  <div key={li.id} className="flex justify-between text-sm py-1">
                    <span className="text-forest-700">{li.quantity}x {li.description}</span>
                    <span className="text-forest-900">{li.line_total.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                ))}
                <div className="border-t border-forest-100 mt-2 pt-2 flex justify-between text-sm font-semibold">
                  <span>Total</span><span>{detail.total_amount.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-sm text-forest-700">
                  <span>Paye</span><span>{detail.amount_paid.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-clay-600">
                  <span>Solde du</span><span>{detail.balance_due.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              {detail.balance_due > 0 && detail.status !== 'cancelled' && (
                <div className="bg-white rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-forest-900 mb-2">Enregistrer un paiement</p>
                  <div className="grid sm:grid-cols-3 gap-2 mb-2">
                    <input type="number" min="0" max={detail.balance_due} placeholder={`Montant (max ${detail.balance_due})`}
                      value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                    <select value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
                      <option value="cash">Especes</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="card">Carte</option>
                    </select>
                    <input placeholder="Reference (optionnel)" value={paymentForm.reference}
                      onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                  </div>
                  <button onClick={submitPayment} disabled={recordingPayment || !paymentForm.amount}
                    className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
                    {recordingPayment ? 'Enregistrement...' : 'Enregistrer le paiement'}
                  </button>
                </div>
              )}

              {detail.payments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-forest-900 mb-2">Historique des paiements</p>
                  <div className="space-y-1">
                    {detail.payments.map((p) => (
                      <p key={p.id} className="text-sm text-forest-700">
                        {new Date(p.paid_at).toLocaleDateString('fr-FR')} - {p.amount.toLocaleString('fr-FR')} FCFA ({p.payment_method}) - {p.recorded_by_name}
                        {p.reference && ` - Ref: ${p.reference}`}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {invoices.length === 0 && <p className="text-forest-700">Aucune facture pour le moment.</p>}
        {invoices.map((inv) => (
          <button key={inv.id} onClick={() => openInvoice(inv.id)}
            className="w-full text-left rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center hover:border-forest-300 transition">
            <div>
              <p className="text-forest-900 font-medium">{inv.invoice_number} - {inv.patient_name}</p>
              <p className="text-sm text-forest-700">{new Date(inv.issued_at).toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="text-right">
              <p className="text-forest-900 font-medium">{inv.total_amount.toLocaleString('fr-FR')} FCFA</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status]}`}>
                {STATUS_LABELS[inv.status] || inv.status}
              </span>
            </div>
          </button>
        ))}
      </div>
        </div>
      )}
    </SidebarLayout>
  )
}
