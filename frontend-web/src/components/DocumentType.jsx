const TYPE_LABELS = {
  prescription: 'Ordonnance',
  lab_result: 'Resultat labo',
  consultation_note: 'Note de consultation',
  certificate: 'Certificat',
  other: 'Autre',
}

const TYPE_COLORS = {
  prescription: 'bg-amber-500/10 text-amber-600',
  lab_result: 'bg-forest-500/10 text-forest-700',
  consultation_note: 'bg-forest-50 text-forest-700',
  certificate: 'bg-forest-50 text-forest-700',
  other: 'bg-forest-50 text-forest-700',
}

export function DocumentTypeBadge({ type }) {
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-medium ${TYPE_COLORS[type] || 'bg-forest-50 text-forest-700'}`}>
      {TYPE_LABELS[type] || type}
    </span>
  )
}

export const DOCUMENT_TYPES = Object.keys(TYPE_LABELS)
export const DOCUMENT_TYPE_LABELS = TYPE_LABELS
