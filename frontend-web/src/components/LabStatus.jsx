const STATUS_LABELS = {
  requested: 'Demandee',
  sample_collected: 'Prelevement fait',
  in_progress: 'En cours',
  validated: 'Validee',
  delivered: 'Rendue',
  cancelled: 'Annulee',
}

const STATUS_COLORS = {
  requested: 'bg-forest-50 text-forest-700',
  sample_collected: 'bg-forest-50 text-forest-700',
  in_progress: 'bg-amber-500/10 text-amber-600',
  validated: 'bg-forest-500/10 text-forest-700',
  delivered: 'bg-forest-500/10 text-forest-700',
  cancelled: 'bg-clay-500/10 text-clay-600',
}

export function LabStatusBadge({ status }) {
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-forest-50 text-forest-700'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export const LAB_STATUSES = Object.keys(STATUS_LABELS)
export const LAB_STATUS_LABELS = STATUS_LABELS
// Ordre du "chemin normal" (sans annulee) - utilise par le stepper visuel.
export const LAB_STEPS = ['requested', 'sample_collected', 'in_progress', 'validated', 'delivered']
