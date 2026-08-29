const STATUS_LABELS = {
  pending: 'En attente de verification',
  awaiting_confirmation: 'A confirmer par toi',
  confirmed: 'Confirmee',
  preparing: 'En preparation',
  ready: 'Prete',
  out_for_delivery: 'En livraison',
  delivered: 'Livree',
  cancelled: 'Annulee',
}

const STATUS_COLORS = {
  pending: 'bg-forest-50 text-forest-700',
  awaiting_confirmation: 'bg-amber-500/10 text-amber-600',
  confirmed: 'bg-forest-50 text-forest-700',
  preparing: 'bg-amber-500/10 text-amber-600',
  ready: 'bg-amber-500/10 text-amber-600',
  out_for_delivery: 'bg-amber-500/10 text-amber-600',
  delivered: 'bg-success-500/10 text-success-700',
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
// Ordre du "chemin normal" (sans annulee) - utilise par le stepper visuel.
export const RESERVATION_STEPS = ['pending', 'awaiting_confirmation', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered']

// BUG CORRIGE: ces deux constantes servaient toutes les deux a un seul et
// meme tableau auparavant, ce qui cachait le bloc d'action pharmacien des
// qu'une commande passait a "confirmed" (le statut n'etait pas dans la
// liste). Le backend acceptait deja la transition depuis "confirmed" -
// seul l'affichage la bloquait. Desormais separees explicitement:

// 1) Statuts COURANTS d'une commande a partir desquels le staff a encore
//    une action a faire -> controle la VISIBILITE du bloc de mise a jour.
export const STAFF_ACTIONABLE_STATUSES = ['confirmed', 'preparing', 'ready', 'out_for_delivery']

// 2) Statuts CIBLES selectionnables dans le menu deroulant -> n'inclut pas
//    "confirmed" (etape deja passee, geree par /confirm) ni "pending"/
//    "awaiting_confirmation" (gerees par /review, dediees au pharmacien).
export const STAFF_UPDATABLE_STATUSES = ['preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']
