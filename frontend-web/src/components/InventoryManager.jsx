import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const BATCH_STATUS_LABELS = {
  disponible: 'Disponible',
  expire_bientot: 'Expire bientôt',
  stock_faible: 'Stock faible',
}
const BATCH_STATUS_COLORS = {
  disponible: 'bg-success-500/10 text-success-700',
  expire_bientot: 'bg-clay-500/10 text-clay-600',
  stock_faible: 'bg-amber-500/10 text-amber-600',
}

/**
 * NOUVEAU (demande explicite de M. Faustin: renommer "Pharmacie" en
 * "Inventaire", avec 3 parties):
 * 1. Enregistrer les informations d'un produit (catalogue)
 * 2. Enregistrer un lot recu pour un produit deja cree
 * 3. Consulter le stock (lots), avec un etat calcule automatiquement
 *    (jamais saisi a la main, pour rester toujours exact)
 */
export default function InventoryManager() {
  const [subTab, setSubTab] = useState('produits')
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState(null)
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
            <input placeholder="Dosage (ex: 500mg)" value={productForm.dosage}
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
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="rounded-xl border border-forest-100 bg-white p-3">
                <p className="text-forest-900 font-medium text-sm">{p.medication_name} <span className="text-xs text-forest-700 font-normal">({p.reference})</span></p>
                <p className="text-xs text-forest-700">
                  {[p.dci, p.dosage, p.form, p.manufacturer].filter(Boolean).join(' - ')}
                </p>
              </div>
            ))}
          </div>
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

      {subTab === 'consultation' && (
        <div>
          {batches === null ? (
            <p className="text-forest-700 text-sm">Chargement...</p>
          ) : batches.length === 0 ? (
            <p className="text-forest-700 text-sm">Aucun lot enregistré pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => (
                <div key={b.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <p className="text-forest-900 font-medium text-sm">{b.medication_name} <span className="text-xs text-forest-700 font-normal">- Lot {b.lot_number}</span></p>
                    <p className="text-xs text-forest-700">
                      Expire le {new Date(b.expiration_date).toLocaleDateString('fr-FR')} - {b.quantity_received} unités reçues - {b.unit_price.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${BATCH_STATUS_COLORS[b.status]}`}>
                    {BATCH_STATUS_LABELS[b.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
