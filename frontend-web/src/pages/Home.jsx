import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-4">LGP HOLDINGS</p>
      <h1 className="font-display text-5xl font-semibold text-forest-900 leading-tight mb-6 max-w-2xl">
        La medecine, reservee comme un vol ou une chambre d'hotel.
      </h1>
      <p className="text-forest-700 max-w-xl mb-10 text-lg">
        Cherche un medecin par specialite, verifie ses disponibilites en temps reel,
        et prends rendez-vous en un clic dans l'un des etablissements adherents au Benin.
        Si ton medecin n'est pas libre, on te propose toujours une alternative.
      </p>
      <div className="flex gap-4">
        <Link to="/rechercher" className="rounded-full bg-forest-700 text-white px-8 py-3.5 font-medium hover:bg-forest-900 transition">
          Trouver un medecin
        </Link>
        <Link to="/pharmacie" className="rounded-full border border-forest-300 text-forest-900 px-8 py-3.5 font-medium hover:bg-forest-50 transition">
          Pharmacie en ligne
        </Link>
      </div>
    </div>
  )
}
