/**
 * NOUVEAU (demande explicite de M. Faustin: "le patient doit avoir la
 * main pour utiliser ces ordonnances pour commander ces analyses").
 * Exact miroir de PrescriptionItemsEditor, mais pour des analyses de
 * laboratoire au lieu de medicaments.
 */
export default function PrescriptionLabItemsEditor({ items, onChange }) {
  function updateItem(idx, field, value) {
    onChange(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function addItem() {
    onChange([...items, { test_name: '', sample_type: '' }])
  }
  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-forest-900 mb-2">Analyses de laboratoire prescrites (optionnel - permet au patient de commander directement au laboratoire)</p>
      <div className="space-y-2 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <input placeholder="Nom de l'analyse (ex: NFS, Glycemie...)" value={item.test_name}
              onChange={(e) => updateItem(idx, 'test_name', e.target.value)}
              className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
            <input placeholder="Type de prelevement (optionnel)" value={item.sample_type}
              onChange={(e) => updateItem(idx, 'sample_type', e.target.value)}
              className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => removeItem(idx)} className="text-xs text-clay-600 hover:underline">Retirer</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addItem} className="text-xs text-amber-600 font-medium hover:underline">
        + Ajouter une analyse
      </button>
    </div>
  )
}
