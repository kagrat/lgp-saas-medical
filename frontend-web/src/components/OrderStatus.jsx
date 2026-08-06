const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmee',
  preparing: 'En preparation',
  ready: 'Prete',
  out_for_delivery: 'En livraison',
  delivered: 'Livree',
  cancelled: 'Annulee',
}

const STATUS_COLORS = {
  pending: 'bg-forest-50 text-forest-700',
  confirmed: 'bg-forest-50 text-forest-700',
  preparing: 'bg-amber-500/10 text-amber-600',
  ready: 'bg-amber-500/10 text-amber-600',
  out_for_delivery: 'bg-amber-500/10 text-amber-600',
  delivered: 'bg-forest-500/10 text-forest-700',
  cancelled: 'bg-clay-500/10 text-clay-600',
}

export function StatusBadge({ status }) {
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-forest-50 text-forest-700'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export const RESERVATION_STATUSES = Object.keys(STATUS_LABELS)
export const RESERVATION_STATUS_LABELS = STATUS_LABELS
