import { Link } from 'react-router-dom'
import { Stethoscope, Pill, FlaskConical, Calendar, MessageCircle, UserRound, Receipt } from 'lucide-react'
import { getRole } from '../api/client'

const QUICK_ACTIONS = [
  { to: '/consultation', label: 'Consultation', icon: Stethoscope },
  { to: '/pharmacie', label: 'Pharmacie', icon: Pill },
  { to: '/laboratoire', label: 'Laboratoire', icon: FlaskConical },
  { to: '/mes-rendez-vous', label: 'Mes rendez-vous', icon: Calendar },
  { to: '/mes-factures', label: 'Mes factures', icon: Receipt },
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
    <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-4">SpeedSanté+</p>
          <h1 className="font-display text-4xl lg:text-5xl font-semibold text-forest-900 leading-tight mb-6">
            La médecine, réservée comme un vol ou une chambre d'hôtel.
          </h1>
          <p className="text-forest-700 mb-10 text-lg">
            Cherche un médecin par spécialité, vérifie ses disponibilités en temps réel,
            et prends rendez-vous en un clic dans l'un des établissements adhérents au Bénin.
            Si ton médecin n'est pas libre, on te propose toujours une alternative.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/consultation" className="rounded-full bg-primary-700 text-white px-8 py-3.5 font-medium hover:bg-primary-900 transition">
              Commencer
            </Link>
            <Link to="/pharmacie" className="rounded-full border border-forest-300 text-forest-900 px-8 py-3.5 font-medium hover:bg-forest-50 transition">
              Pharmacie en ligne
            </Link>
          </div>
          <p className="text-sm text-forest-700 mt-8">
            Déjà un compte ?{' '}
            <Link to="/connexion" className="text-amber-600 font-medium hover:underline">Se connecter</Link>
          </p>
        </div>

        <div className="relative">
          <img
            src="/images/hero-medical-team.jpg"
            alt="Équipe médicale au Bénin"
            className="w-full h-[420px] lg:h-[520px] object-cover rounded-3xl shadow-lg"
          />
          <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-lg px-5 py-4 hidden sm:block">
            <p className="font-display text-2xl font-semibold text-forest-900">4</p>
            <p className="text-xs text-forest-700">types d'établissements adhérents</p>
          </div>
        </div>
      </div>
    </div>
  )
}
