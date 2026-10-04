const TYPE_LABELS = {
  prescription: 'Ordonnance',
  lab_result: 'Examen labo',
  consultation_note: 'Note de consultation',
  certificate: 'Certificat',
  other: 'Autre',
  // CORRIGE (trouve en verifiant le nouveau correctif du compte-rendu de
  // sortie): ces 3 types existaient deja mais n'avaient jamais d'etiquette
  // francaise - la valeur technique brute s'affichait a la place.
  daily_progress_note: 'Note médicale (tournée)',
  nursing_note: 'Note de soins',
  discharge_summary: 'Compte-rendu de sortie',
}

const TYPE_COLORS = {
  prescription: 'bg-amber-500/10 text-amber-600',
  lab_result: 'bg-success-500/10 text-success-700',
  consultation_note: 'bg-forest-50 text-forest-700',
  certificate: 'bg-forest-50 text-forest-700',
  other: 'bg-forest-50 text-forest-700',
  daily_progress_note: 'bg-secondary-500/10 text-secondary-600',
  nursing_note: 'bg-primary-500/10 text-primary-700',
  discharge_summary: 'bg-clay-500/10 text-clay-600',
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

// CORRIGE (regression evitee de justesse): daily_progress_note,
// nursing_note et discharge_summary sont des types propres a une
// HOSPITALISATION (admission_id), jamais choisis manuellement par un
// medecin pendant un simple rendez-vous - contrairement aux badges
// (DOCUMENT_TYPE_LABELS/DocumentTypeBadge, utilises partout), la liste
// DEROULANTE proposee au medecin pour un rendez-vous classique doit les
// exclure.
export const SELECTABLE_DOCUMENT_TYPES = DOCUMENT_TYPES.filter(
  (t) => !['daily_progress_note', 'nursing_note', 'discharge_summary'].includes(t)
)
