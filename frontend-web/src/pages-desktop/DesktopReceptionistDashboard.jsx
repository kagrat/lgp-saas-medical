import MySchedule from '../components/MySchedule'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin): espace accueil -
 * remplace partiellement le placeholder "en construction". L'enregistrement
 * des arrivees patients et l'encaissement a la sortie restent a construire
 * (chantier reception dedie) - en attendant, le receptionniste voit au
 * moins son propre planning et peut demander un conge, comme tout le
 * personnel.
 */
export default function DesktopReceptionistDashboard() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Accueil</p>
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">Espace accueil</h1>
      <p className="text-forest-700 mb-8">
        L'enregistrement des arrivees patients et l'encaissement arrivent dans une prochaine mise a jour.
        En attendant, retrouve ton planning et tes demandes de conge ci-dessous.
      </p>

      <MySchedule />
    </div>
  )
}
