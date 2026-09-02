import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const PO_STATUS_LABELS = { pending: 'En attente', received: 'Recu', cancelled: 'Annule' }
const PO_STATUS_COLORS = {
  pending: 'bg-amber-500/10 text-amber-600', received: 'bg-success-500/10 text-success-700', cancelled: 'bg-clay-500/10 text-clay-600',
}

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin) - dernier
 * chantier du cahier des charges: equipement medical general avec
 * maintenance preventive, fournisseurs, bons de commande.
 */
export default function EquipmentSuppliersManager() {
  const [equipment, setEquipment] = useState([])
  const [departments, setDepartments] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [error, setError] = useState('')

  const [equipForm, setEquipForm] = useState({ name: '', category: '', department_id: '', status: 'fonctionnel', next_maintenance_date: '' })
  const [savingEquip, setSavingEquip] = useState(false)
  const [editingEquipmentId, setEditingEquipmentId] = useState(null)
  const [editEquipForm, setEditEquipForm] = useState({ name: '', category: '', department_id: '', status: 'fonctionnel', next_maintenance_date: '' })
  const [savingEquipEdit, setSavingEquipEdit] = useState(false)

  const [supplierForm, setSupplierForm] = useState({ name: '', contact_phone: '', contact_email: '' })
  const [savingSupplier, setSavingSupplier] = useState(false)

  const [poForm, setPoForm] = useState({ supplier_id: '', inventory_item_id: '', description: '', quantity: '1' })
  const [savingPo, setSavingPo] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setError('')
    try {
      const [equipRes, deptRes, supplierRes, inventoryRes, poRes] = await Promise.all([
        api.get('/equipment/mine'),
        api.get('/establishments/departments'),
        api.get('/suppliers/mine'),
        api.get('/inventory/mine'),
        api.get('/purchase-orders/mine'),
      ])
      setEquipment(equipRes.data)
      setDepartments(deptRes.data)
      setSuppliers(supplierRes.data)
      setInventoryItems(inventoryRes.data)
      setPurchaseOrders(poRes.data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger l'equipement et les fournisseurs."))
    }
  }

  async function submitEquipment(e) {
    e.preventDefault()
    setSavingEquip(true)
    setError('')
    try {
      await api.post('/equipment', {
        name: equipForm.name, category: equipForm.category || null, department_id: equipForm.department_id || null,
        status: equipForm.status, next_maintenance_date: equipForm.next_maintenance_date || null,
      })
      setEquipForm({ name: '', category: '', department_id: '', status: 'fonctionnel', next_maintenance_date: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cet equipement."))
    } finally {
      setSavingEquip(false)
    }
  }

  async function deleteEquipment(id) {
    try {
      await api.delete(`/equipment/${id}`)
      await load()
    } catch {
      setError('Suppression impossible.')
    }
  }

  function startEditEquipment(eq) {
    setEditingEquipmentId(eq.id)
    setEditEquipForm({
      name: eq.name, category: eq.category || '', department_id: eq.department_id || '',
      status: eq.status, next_maintenance_date: eq.next_maintenance_date || '',
    })
  }

  async function submitEquipmentEdit(e) {
    e.preventDefault()
    setSavingEquipEdit(true)
    setError('')
    try {
      await api.patch(`/equipment/${editingEquipmentId}`, {
        name: editEquipForm.name, category: editEquipForm.category || null,
        department_id: editEquipForm.department_id || null, status: editEquipForm.status,
        next_maintenance_date: editEquipForm.next_maintenance_date || null,
      })
      setEditingEquipmentId(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de modifier cet equipement."))
    } finally {
      setSavingEquipEdit(false)
    }
  }

  async function deleteSupplier(id) {
    try {
      await api.delete(`/suppliers/${id}`)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Suppression impossible (peut-etre lie a un bon de commande existant).'))
    }
  }

  async function submitSupplier(e) {
    e.preventDefault()
    setSavingSupplier(true)
    setError('')
    try {
      await api.post('/suppliers', {
        name: supplierForm.name, contact_phone: supplierForm.contact_phone || null,
        contact_email: supplierForm.contact_email || null,
      })
      setSupplierForm({ name: '', contact_phone: '', contact_email: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce fournisseur."))
    } finally {
      setSavingSupplier(false)
    }
  }

  async function submitPurchaseOrder(e) {
    e.preventDefault()
    setSavingPo(true)
    setError('')
    try {
      await api.post('/purchase-orders', {
        supplier_id: poForm.supplier_id, inventory_item_id: poForm.inventory_item_id || null,
        description: poForm.description, quantity: Number(poForm.quantity) || 1,
      })
      setPoForm({ supplier_id: '', inventory_item_id: '', description: '', quantity: '1' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de creer ce bon de commande.'))
    } finally {
      setSavingPo(false)
    }
  }

  async function receivePo(id) {
    setError('')
    try {
      await api.post(`/purchase-orders/${id}/receive`)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Reception impossible.'))
    }
  }

  async function cancelPo(id) {
    setError('')
    try {
      await api.post(`/purchase-orders/${id}/cancel`)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Annulation impossible.'))
    }
  }

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Equipement medical</h3>
      <form onSubmit={submitEquipment} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom (ex: Echographe)" value={equipForm.name}
          onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input placeholder="Categorie (optionnel)" value={equipForm.category}
          onChange={(e) => setEquipForm({ ...equipForm, category: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <select value={equipForm.department_id} onChange={(e) => setEquipForm({ ...equipForm, department_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="">Departement (optionnel)</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={equipForm.status} onChange={(e) => setEquipForm({ ...equipForm, status: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="fonctionnel">Fonctionnel</option>
          <option value="maintenance">En maintenance</option>
          <option value="hors_service">Hors service</option>
        </select>
        <div className="sm:col-span-2">
          <label className="block text-xs text-forest-700 mb-1">Prochaine maintenance preventive (optionnel)</label>
          <input type="date" value={equipForm.next_maintenance_date}
            onChange={(e) => setEquipForm({ ...equipForm, next_maintenance_date: e.target.value })}
            className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={savingEquip}
          className="sm:col-span-2 rounded-full bg-[var(--portal-accent)] text-white py-2.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
          {savingEquip ? 'Ajout...' : 'Ajouter cet equipement'}
        </button>
      </form>
      <div className="space-y-2 mb-8">
        {equipment.length === 0 && <p className="text-forest-700 text-sm">Aucun equipement enregistre.</p>}
        {equipment.map((eq) => (
          editingEquipmentId === eq.id ? (
            <form key={eq.id} onSubmit={submitEquipmentEdit} className="grid sm:grid-cols-2 gap-3 bg-white border border-primary-500 rounded-xl p-4">
              <input required placeholder="Nom" value={editEquipForm.name}
                onChange={(e) => setEditEquipForm({ ...editEquipForm, name: e.target.value })}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
              <input placeholder="Categorie (optionnel)" value={editEquipForm.category}
                onChange={(e) => setEditEquipForm({ ...editEquipForm, category: e.target.value })}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
              <select value={editEquipForm.department_id} onChange={(e) => setEditEquipForm({ ...editEquipForm, department_id: e.target.value })}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
                <option value="">Departement (optionnel)</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={editEquipForm.status} onChange={(e) => setEditEquipForm({ ...editEquipForm, status: e.target.value })}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
                <option value="fonctionnel">Fonctionnel</option>
                <option value="maintenance">En maintenance</option>
                <option value="hors_service">Hors service</option>
              </select>
              <div className="sm:col-span-2">
                <label className="block text-xs text-forest-700 mb-1">Prochaine maintenance preventive (optionnel)</label>
                <input type="date" value={editEquipForm.next_maintenance_date}
                  onChange={(e) => setEditEquipForm({ ...editEquipForm, next_maintenance_date: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" disabled={savingEquipEdit}
                  className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
                  {savingEquipEdit ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button type="button" onClick={() => setEditingEquipmentId(null)} className="text-sm text-forest-700 hover:underline">
                  Annuler
                </button>
              </div>
            </form>
          ) : (
          <div key={eq.id} className={`rounded-xl border p-4 flex justify-between items-center ${eq.maintenance_due ? 'border-clay-300 bg-clay-500/5' : 'border-forest-100 bg-white'}`}>
            <div>
              <p className="text-forest-900 font-medium">
                {eq.name}
                {eq.maintenance_due && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-clay-500/10 text-clay-600 font-medium">Maintenance a prevoir</span>}
              </p>
              <p className="text-sm text-forest-700">
                {eq.category ? `${eq.category} - ` : ''}{eq.department_name ? `${eq.department_name} - ` : ''}{eq.status}
                {eq.next_maintenance_date && ` - prochaine maintenance: ${new Date(eq.next_maintenance_date).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
            <div className="flex gap-3 shrink-0 ml-3">
              <button onClick={() => startEditEquipment(eq)} className="text-sm text-primary-700 hover:underline">Modifier</button>
              <button onClick={() => deleteEquipment(eq.id)} className="text-sm text-clay-600 hover:underline">Supprimer</button>
            </div>
          </div>
          )
        ))}
      </div>

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Fournisseurs</h3>
      <form onSubmit={submitSupplier} className="grid sm:grid-cols-3 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom du fournisseur" value={supplierForm.name}
          onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input placeholder="Telephone (optionnel)" value={supplierForm.contact_phone}
          onChange={(e) => setSupplierForm({ ...supplierForm, contact_phone: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input placeholder="Email (optionnel)" value={supplierForm.contact_email}
          onChange={(e) => setSupplierForm({ ...supplierForm, contact_email: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <button type="submit" disabled={savingSupplier}
          className="sm:col-span-3 rounded-full bg-[var(--portal-accent)] text-white py-2.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
          {savingSupplier ? 'Ajout...' : 'Ajouter ce fournisseur'}
        </button>
      </form>
      <div className="flex flex-wrap gap-2 mb-8">
        {suppliers.length === 0 && <p className="text-forest-700 text-sm">Aucun fournisseur enregistre.</p>}
        {suppliers.map((s) => (
          <span key={s.id} className="text-sm bg-forest-50 text-forest-900 px-3 py-1.5 rounded-full flex items-center gap-2">
            {s.name}{s.contact_phone ? ` - ${s.contact_phone}` : ''}
            <button onClick={() => deleteSupplier(s.id)} className="text-clay-600 hover:text-clay-500 font-bold" aria-label="Supprimer ce fournisseur">
              x
            </button>
          </span>
        ))}
      </div>

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Bons de commande</h3>
      <form onSubmit={submitPurchaseOrder} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <select required value={poForm.supplier_id} onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="">Fournisseur</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={poForm.inventory_item_id} onChange={(e) => setPoForm({ ...poForm, inventory_item_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="">Article de stock lie (optionnel)</option>
          {inventoryItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <input required placeholder="Description (ex: Reappro gants latex)" value={poForm.description}
          onChange={(e) => setPoForm({ ...poForm, description: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input required type="number" min="1" placeholder="Quantite" value={poForm.quantity}
          onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <button type="submit" disabled={savingPo}
          className="sm:col-span-2 rounded-full bg-[var(--portal-accent)] text-white py-2.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
          {savingPo ? 'Envoi...' : 'Passer la commande'}
        </button>
      </form>
      {poForm.inventory_item_id && (
        <p className="text-xs text-forest-500 -mt-2 mb-4">
          A la reception, la quantite sera automatiquement ajoutee au stock de cet article.
        </p>
      )}
      <div className="space-y-2">
        {purchaseOrders.length === 0 && <p className="text-forest-700 text-sm">Aucun bon de commande.</p>}
        {purchaseOrders.map((po) => (
          <div key={po.id} className="rounded-xl border border-forest-100 bg-white p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-forest-900 font-medium">{po.description}</p>
                <p className="text-sm text-forest-700">
                  {po.quantity} unite(s) - {po.supplier_name}{po.inventory_item_name ? ` - lie a: ${po.inventory_item_name}` : ''}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PO_STATUS_COLORS[po.status]}`}>
                {PO_STATUS_LABELS[po.status]}
              </span>
            </div>
            {po.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => receivePo(po.id)} className="text-sm bg-[var(--portal-accent)] text-white px-4 py-1.5 rounded-full font-medium hover:brightness-90 transition">
                  Marquer recu
                </button>
                <button onClick={() => cancelPo(po.id)} className="text-sm border border-clay-500 text-clay-600 px-4 py-1.5 rounded-full font-medium hover:bg-clay-500 hover:text-white transition">
                  Annuler
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
