import { useEffect, useState } from 'react'
import { Pill } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'

// NOUVEAU (demande explicite de M. Faustin: icone coloree par produit,
// comme sur sa capture d'ecran) - couleur derivee du nom du produit, pour
// que le meme medicament garde toujours la meme couleur.
const PRODUCT_ICON_COLORS = ['bg-primary-500', 'bg-clay-500', 'bg-secondary-500', 'bg-success-600', 'bg-amber-500']
function hashToIndex(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash % PRODUCT_ICON_COLORS.length
}

const BATCH_STATUS_LABELS = {
  disponible: 'Disponible',
  expire_bientot: 'Expire bientôt',
  stock_faible: 'Stock faible',
}
const BATCH_STATUS_COLORS = {
  disponible: 'bg-success-500/10 text-success-700',
  expire_bientot: 'bg-amber-500/10 text-amber-600',
  stock_faible: 'bg-clay-500/10 text-clay-600',
}

/**
 * NOUVEAU (demande explicite de M. Faustin: renommer "Pharmacie" en
 * "Inventaire", avec 3 parties):
 * 1. Enregistrer les informations d'un produit (catalogue)
 * 2. Enregistrer un lot recu pour un produit deja cree
 * 3. Consulter le stock (lots), avec un etat calcule automatiquement
 *    (jamais saisi a la main, pour rester toujours exact)
 */
export default function InventoryManager({ initialSubTab = 'produits' }) {
  const [subTab, setSubTab] = useState(initialSubTab)
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState(null)
  const [consultationSearch, setConsultationSearch] = useState('')
  const [error, setError] = useState('')

  const [productForm, setProductForm] = useState({
    reference: '', medication_name: '', unit_of_sale: '', dci: '', units_per_box: '',
    category: '', unit_price: '', form: '', dosage: '', quantity: '0', alert_threshold: '10', manufacturer: '',
  })
  const [savingProduct, setSavingProduct] = useState(false)
  const [productMessage, setProductMessage] = useState('')

  const [batchForm, setBatchForm] = useState({ stock_item_id: '', lot_number: '', received_at: '', quantity_received: '', expiration_date: '' })
  const [savingBatch, setSavingBatch] = useState(false)
  const [batchMessage, setBatchMessage] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (subTab === 'consultation') loadBatches()
  }, [subTab])

  async function loadProducts() {
    try {
      const { data } = await api.get('/pharmacy/stock')
      setProducts(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les produits.'))
    }
  }

  async function loadBatches() {
    try {
      const { data } = await api.get('/pharmacy/stock/batches')
      setBatches(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le stock.'))
    }
  }

  async function submitProduct(e) {
    e.preventDefault()
    setSavingProduct(true)
    setProductMessage('')
    setError('')
    try {
      await api.post('/pharmacy/stock', {
        reference: productForm.reference, medication_name: productForm.medication_name,
        category: productForm.category || null, quantity: Number(productForm.quantity) || 0,
        alert_threshold: Number(productForm.alert_threshold) || 10, unit_price: Number(productForm.unit_price) || 0,
        unit_of_sale: productForm.unit_of_sale || null, dci: productForm.dci || null,
        units_per_box: productForm.units_per_box ? Number(productForm.units_per_box) : null,
        form: productForm.form || null, dosage: productForm.dosage || null, manufacturer: productForm.manufacturer || null,
      })
      setProductMessage('Produit enregistré dans le catalogue.')
      setProductForm({ reference: '', medication_name: '', unit_of_sale: '', dci: '', units_per_box: '', category: '', unit_price: '', form: '', dosage: '', quantity: '0', alert_threshold: '10', manufacturer: '' })
      await loadProducts()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer ce produit."))
    } finally {
      setSavingProduct(false)
    }
  }

  async function submitBatch(e) {
    e.preventDefault()
    setSavingBatch(true)
    setBatchMessage('')
    setError('')
    try {
      await api.post('/pharmacy/stock/batches', {
        stock_item_id: batchForm.stock_item_id, lot_number: batchForm.lot_number,
        received_at: batchForm.received_at, quantity_received: Number(batchForm.quantity_received),
        expiration_date: batchForm.expiration_date,
      })
      setBatchMessage('Lot enregistré - stock mis à jour.')
      setBatchForm({ stock_item_id: '', lot_number: '', received_at: '', quantity_received: '', expiration_date: '' })
      await loadProducts()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer ce lot."))
    } finally {
      setSavingBatch(false)
    }
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-forest-100 mb-5">
        {[
          { id: 'produits', label: '1. Produits' },
          { id: 'reception', label: '2. Réception de stock' },
          { id: 'consultation', label: '3. Consultation du stock' },
        ].map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${subTab === t.id ? 'border-[var(--portal-accent)] text-forest-900' : 'border-transparent text-forest-700 hover:text-forest-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {subTab === 'produits' && (
        <div>
          <form onSubmit={submitProduct} className="grid sm:grid-cols-3 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-6">
            {productMessage && <p className="sm:col-span-3 text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 text-sm">{productMessage}</p>}
            <input required placeholder="Nom du produit" value={productForm.medication_name}
              onChange={(e) => setProductForm({ ...productForm, medication_name: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required placeholder="Code produit (référence)" value={productForm.reference}
              onChange={(e) => setProductForm({ ...productForm, reference: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Unité de vente (ex: Boîte)" value={productForm.unit_of_sale}
              onChange={(e) => setProductForm({ ...productForm, unit_of_sale: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="DCI / principe actif" value={productForm.dci}
              onChange={(e) => setProductForm({ ...productForm, dci: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input type="number" min="1" placeholder="Unités / boîte" value={productForm.units_per_box}
              onChange={(e) => setProductForm({ ...productForm, units_per_box: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Catégorie" value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="number" min="0" placeholder="Prix de vente (FCFA)" value={productForm.unit_price}
              onChange={(e) => setProductForm({ ...productForm, unit_price: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Forme (ex: Comprimé)" value={productForm.form}
              onChange={(e) => setProductForm({ ...productForm, form: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Dosage (ex: 500 mg)" value={productForm.dosage}
              onChange={(e) => setProductForm({ ...productForm, dosage: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input type="number" min="0" placeholder="Stock initial" value={productForm.quantity}
              onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input type="number" min="0" placeholder="Stock minimum (alerte)" value={productForm.alert_threshold}
              onChange={(e) => setProductForm({ ...productForm, alert_threshold: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Fabricant" value={productForm.manufacturer}
              onChange={(e) => setProductForm({ ...productForm, manufacturer: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <button type="submit" disabled={savingProduct}
              className="sm:col-span-3 rounded-full bg-[var(--portal-accent)] text-white py-2.5 font-medium hover:brightness-90 transition disabled:opacity-50">
              {savingProduct ? 'Enregistrement...' : 'Enregistrer ce produit'}
            </button>
          </form>

          <p className="text-sm font-medium text-forest-900 mb-2">Catalogue ({products.length})</p>
          {products.length === 0 ? (
            <p className="text-forest-700 text-sm">Aucun produit enregistré.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-forest-100 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-forest-100 text-left text-forest-700">
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">Référence</th>
                    <th className="px-4 py-3 font-medium">DCI</th>
                    <th className="px-4 py-3 font-medium">Dosage</th>
                    <th className="px-4 py-3 font-medium">Forme</th>
                    <th className="px-4 py-3 font-medium">Fabricant</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-forest-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${PRODUCT_ICON_COLORS[hashToIndex(p.medication_name)]}`}>
                            <Pill size={13} className="text-white" />
                          </span>
                          <span className="text-forest-900 font-medium">{p.medication_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-forest-700">{p.reference}</td>
                      <td className="px-4 py-3 text-forest-700">{p.dci || '—'}</td>
                      <td className="px-4 py-3 text-forest-700">{p.dosage || '—'}</td>
                      <td className="px-4 py-3 text-forest-700">{p.form || '—'}</td>
                      <td className="px-4 py-3 text-forest-700">{p.manufacturer || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'reception' && (
        <div>
          <form onSubmit={submitBatch} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-6">
            {batchMessage && <p className="sm:col-span-2 text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 text-sm">{batchMessage}</p>}
            <select required value={batchForm.stock_item_id} onChange={(e) => setBatchForm({ ...batchForm, stock_item_id: e.target.value })}
              className="sm:col-span-2 rounded-lg border border-forest-100 px-3 py-2 bg-white">
              <option value="">Choisis un produit...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.medication_name} ({p.reference})</option>)}
            </select>
            <input required placeholder="Numéro de lot" value={batchForm.lot_number}
              onChange={(e) => setBatchForm({ ...batchForm, lot_number: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="number" min="1" placeholder="Quantité reçue" value={batchForm.quantity_received}
              onChange={(e) => setBatchForm({ ...batchForm, quantity_received: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <div>
              <label className="block text-xs text-forest-700 mb-1">Date de réception</label>
              <input required type="date" value={batchForm.received_at}
                onChange={(e) => setBatchForm({ ...batchForm, received_at: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-forest-700 mb-1">Date d'expiration</label>
              <input required type="date" value={batchForm.expiration_date}
                onChange={(e) => setBatchForm({ ...batchForm, expiration_date: e.target.value })}
                className="w-full rounded-lg border border-forest-100 px-3 py-2" />
            </div>
            <button type="submit" disabled={savingBatch}
              className="sm:col-span-2 rounded-full bg-[var(--portal-accent)] text-white py-2.5 font-medium hover:brightness-90 transition disabled:opacity-50">
              {savingBatch ? 'Enregistrement...' : 'Enregistrer ce lot'}
            </button>
          </form>
          {products.length === 0 && (
            <p className="text-sm text-forest-700">Enregistre d'abord un produit dans l'onglet "1. Produits" avant de recevoir du stock.</p>
          )}
        </div>
      )}

      {/* NOUVEAU (demande explicite de M. Faustin: presenter la
          consultation du stock exactement comme sa capture d'ecran -
          vrai tableau avec colonnes, pas une liste de cartes). */}
      {subTab === 'consultation' && (
        <div>
          {/* NOUVEAU (demande explicite de M. Faustin: barre de
              recherche de produits pour la consultation du stock). */}
          {/* NOUVEAU (demande explicite de M. Faustin: le rectangle "Alertes de
              stock" du tableau de bord doit etre cliquable). Meme condition
              que le chiffre du tableau de bord (quantite <= seuil d'alerte,
              cote serveur: low_stock_items) - le chiffre annonce et la liste
              affichee ici sont donc toujours identiques. */}
          {products.filter((p) => p.quantity <= p.alert_threshold).length > 0 && (
            <div className="rounded-xl border border-clay-500 bg-clay-500/5 p-4 mb-4">
              <p className="text-sm font-medium text-clay-600 mb-2">
                Alertes de stock ({products.filter((p) => p.quantity <= p.alert_threshold).length})
              </p>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {products.filter((p) => p.quantity <= p.alert_threshold).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-forest-900">
                      {p.medication_name} <span className="text-xs text-forest-700">({p.reference})</span>
                    </span>
                    <span className="text-clay-600 font-medium shrink-0">
                      Stock : {p.quantity} / seuil {p.alert_threshold}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={consultationSearch}
            onChange={(e) => setConsultationSearch(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-forest-100 px-3 py-2 text-sm mb-4"
          />
          {batches === null ? (
            <p className="text-forest-700 text-sm">Chargement...</p>
          ) : batches.length === 0 ? (
            <p className="text-forest-700 text-sm">Aucun lot enregistré pour le moment.</p>
          ) : (
            (() => {
              const filteredBatches = consultationSearch.trim()
                ? batches.filter((b) => b.medication_name.toLowerCase().includes(consultationSearch.trim().toLowerCase()))
                : batches
              if (filteredBatches.length === 0) {
                return <p className="text-forest-700 text-sm">Aucun produit ne correspond à "{consultationSearch}".</p>
              }
              return (
            <div className="overflow-x-auto rounded-xl border border-forest-100 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-forest-100 text-left text-forest-700">
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">Lot</th>
                    <th className="px-4 py-3 font-medium">Expiration</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Prix vente</th>
                    <th className="px-4 py-3 font-medium">État</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b) => (
                    <tr key={b.id} className="border-b border-forest-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${PRODUCT_ICON_COLORS[hashToIndex(b.medication_name)]}`}>
                            <Pill size={13} className="text-white" />
                          </span>
                          <span className="text-forest-900 font-medium">{b.medication_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-forest-700">{b.lot_number}</td>
                      <td className="px-4 py-3 text-forest-700">{new Date(b.expiration_date).toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-forest-700">{b.quantity_received}</td>
                      <td className="px-4 py-3 text-forest-700">{b.unit_price.toLocaleString('fr-FR')} F</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${BATCH_STATUS_COLORS[b.status]}`}>
                          {BATCH_STATUS_LABELS[b.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              )
            })()
          )}
        </div>
      )}
    </div>
  )
}
