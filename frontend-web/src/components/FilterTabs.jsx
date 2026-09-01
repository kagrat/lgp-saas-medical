/**
 * Onglets de filtre reutilisables (RDV, commandes, analyses...). Filtre
 * une liste deja chargee cote client - aucun appel API supplementaire.
 */
export default function FilterTabs({ options, active, onChange, counts }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-sm px-4 py-1.5 rounded-full font-medium transition ${
            active === opt.value
              ? 'bg-[var(--portal-accent)] text-white'
              : 'border border-forest-100 text-forest-700 hover:bg-forest-50'
          }`}
        >
          {opt.label}
          {counts && counts[opt.value] !== undefined ? ` (${counts[opt.value]})` : ''}
        </button>
      ))}
    </div>
  )
}
