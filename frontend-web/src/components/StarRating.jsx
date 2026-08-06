/**
 * Affiche une note moyenne sous forme d'etoiles. Purement visuel, pas
 * interactif ici (la saisie d'un avis est un formulaire separe).
 */
export default function StarRating({ rating, reviewCount, size = 'text-sm' }) {
  if (rating === null || rating === undefined) {
    return <span className={`${size} text-forest-700`}>Pas encore d'avis</span>
  }

  const fullStars = Math.round(rating)

  return (
    <span className={`${size} inline-flex items-center gap-1`}>
      <span className="text-amber-500" aria-hidden="true">
        {'★'.repeat(fullStars)}{'☆'.repeat(5 - fullStars)}
      </span>
      <span className="text-forest-700">
        {rating.toFixed(1)} {reviewCount ? `(${reviewCount} avis)` : ''}
      </span>
    </span>
  )
}
