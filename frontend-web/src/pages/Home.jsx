import { Link } from 'react-router-dom'
import { Stethoscope, Pill, FlaskConical, Calendar, MessageCircle, UserRound } from 'lucide-react'
import { getRole } from '../api/client'

const QUICK_ACTIONS = [
  { to: '/rechercher', label: 'Trouver un medecin', icon: Stethoscope },
  { to: '/pharmacie', label: 'Pharmacie', icon: Pill },
  { to: '/laboratoire', label: 'Laboratoire', icon: FlaskConical },
  { to: '/espace-patient', label: 'Mes rendez-vous', icon: Calendar },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/profil', label: 'Mon profil', icon: UserRound },
]

export default function Home() {
  const role = getRole()

  if (role === 'patient') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-14">
        <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Bienvenue</p>
        <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Que veux-tu faire aujourd'hui ?</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to} to={to}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-forest-100 bg-white p-6 text-center hover:border-forest-300 hover:shadow-sm transition"
            >
              <span className="w-12 h-12 rounded-full bg-forest-50 flex items-center justify-center">
                <Icon className="w-6 h-6 text-forest-700" strokeWidth={1.75} />
              </span>
              <span className="text-sm font-medium text-forest-900">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

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
