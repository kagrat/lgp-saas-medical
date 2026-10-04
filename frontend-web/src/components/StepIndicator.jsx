export default function StepIndicator({ current, total, label }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full ${step <= current ? 'bg-amber-500' : 'bg-forest-100'}`}
          />
        ))}
      </div>
      <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">
        Étape {current} sur {total}{label ? ` - ${label}` : ''}
      </p>
    </div>
  )
}
