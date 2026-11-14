/**
 * Historique des consultations d'un patient: pour CHAQUE consultation, la date
 * et l'heure, le numero de dossier du patient, le medecin et l'etablissement
 * (demande de M. Faustin: l'historique n'affichait que la date et l'heure).
 */
export default function ConsultationHistory({ appointments }) {
  if (!appointments || appointments.length === 0) {
    return <p className="text-sm text-forest-700">Aucune consultation enregistrée.</p>
  }
  return (
    <div className="space-y-2">
      {appointments.map((ap) => (
        <div key={ap.id} className="bg-forest-50 rounded-lg p-3 text-sm">
          <p className="text-forest-900 font-medium">
            {new Date(ap.scheduled_at).toLocaleDateString('fr-FR')} à{' '}
            {new Date(ap.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-forest-700">
            <dt>N° de dossier</dt><dd className="text-forest-900">{ap.dossier_number || '—'}</dd>
            <dt>Médecin</dt><dd className="text-forest-900">{ap.doctor_name || '—'}</dd>
            <dt>Établissement</dt><dd className="text-forest-900">{ap.establishment_name || '—'}</dd>
          </dl>
        </div>
      ))}
    </div>
  )
}

/** Ligne d'identification d'un document: n° de dossier patient, auteur, date. */
export function DocumentIdentity({ doc, showEstablishment = false }) {
  return (
    <p className="text-xs text-forest-700 mb-1">
      <span className="font-medium text-forest-900">N° dossier : {doc.dossier_number || '—'}</span>
      {' · '}{doc.doctor_name}
      {showEstablishment && doc.establishment_name ? ` · ${doc.establishment_name}` : ''}
      {' · '}{new Date(doc.created_at).toLocaleDateString('fr-FR')}
    </p>
  )
}
