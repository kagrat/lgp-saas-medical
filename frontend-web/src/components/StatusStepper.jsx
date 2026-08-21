/**
 * Barre de progression visuelle (style "etapes") pour un statut qui avance
 * dans un ordre fixe - ex: analyses labo (Recu > En cours > A valider > Rendu),
 * commandes pharmacie (En attente > Confirmee > Preparation > Prete > Livree).
 * "cancelled" est traite a part (affiche en rouge, hors de la ligne).
 */
export default function StatusStepper({ steps, currentValue, labels }) {
  if (currentValue === 'cancelled' || currentValue === 'annulee') {
    return (
      <div className="text-sm font-medium text-clay-600 bg-clay-500/10 rounded-full px-4 py-2 inline-block">
        Annulée
      </div>
    )
  }

  const currentIndex = steps.indexOf(currentValue)

  return (
    <div className="flex items-center w-full">
      {steps.map((step, idx) => {
        const isDone = idx < currentIndex
        const isCurrent = idx === currentIndex
        const isUpcoming = idx > currentIndex
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isDone ? 'bg-forest-700 text-white' :
                  isCurrent ? 'bg-amber-500 text-forest-900' :
                  'bg-forest-50 text-forest-700'
                }`}
              >
                {isDone ? '✓' : idx + 1}
              </div>
              <span className={`text-[11px] mt-1 text-center max-w-[70px] ${isCurrent ? 'text-forest-900 font-medium' : 'text-forest-700'}`}>
                {labels[step]}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${isDone ? 'bg-forest-700' : 'bg-forest-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
