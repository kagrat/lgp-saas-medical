/**
 * NOUVEAU (lien ordonnance -> pharmacie): liste structuree de medicaments
 * au sein d'une ordonnance, en plus du texte libre. Composant partage par
 * MyPatients.jsx et DesktopDoctorDashboard.jsx - une seule logique, pas de
 * duplication (lecon retenue d'un bug precedent duplique a 2 endroits).
 */
export default function PrescriptionItemsEditor({ items, onChange }) {
  function updateItem(idx, field, value) {
    onChange(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function addItem() {
    onChange([...items, { medication_name: '', quantity: 1, dosage_instructions: '' }])
  }
  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-forest-900 mb-2">Medicaments prescrits (optionnel - permet au patient de commander directement en pharmacie)</p>
      <div className="space-y-2 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className="grid sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
            <input placeholder="Nom du medicament" value={item.medication_name}
              onChange={(e) => updateItem(idx, 'medication_name', e.target.value)}
              className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
            <input type="number" min="1" placeholder="Qte" value={item.quantity}
              onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
              className="w-16 rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
            <input placeholder="Posologie (ex: 3x/jour)" value={item.dosage_instructions}
              onChange={(e) => updateItem(idx, 'dosage_instructions', e.target.value)}
              className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => removeItem(idx)} className="text-xs text-clay-600 hover:underline">Retirer</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addItem} className="text-xs text-amber-600 font-medium hover:underline">
        + Ajouter un medicament
      </button>
    </div>
  )
}
