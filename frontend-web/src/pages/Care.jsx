import { Link } from 'react-router-dom'
import { Stethoscope, Pill, FlaskConical, Video } from 'lucide-react'

const CATEGORIES = [
  { to: '/rechercher', label: 'Medecins', description: 'Consultations dans les hopitaux et cliniques adherents', icon: Stethoscope },
  { to: '/pharmacie', label: 'Pharmacies', description: 'Medicaments disponibles pres de chez toi', icon: Pill },
  { to: '/laboratoire', label: 'Laboratoires', description: 'Analyses medicales et resultats', icon: FlaskConical },
]

export default function Care() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Soins</p>
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Que cherches-tu ?</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {CATEGORIES.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to} to={to}
            className="flex flex-col gap-3 rounded-2xl border border-forest-100 bg-white p-6 hover:border-forest-300 hover:shadow-sm transition"
          >
            <span className="w-12 h-12 rounded-full bg-forest-50 flex items-center justify-center">
              <Icon className="w-6 h-6 text-forest-700" strokeWidth={1.75} />
            </span>
            <span className="font-display text-lg text-forest-900 font-semibold">{label}</span>
            <span className="text-sm text-forest-700">{description}</span>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-forest-100 bg-forest-50 p-6 flex items-center gap-4">
        <span className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
          <Video className="w-6 h-6 text-forest-700" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-display text-lg text-forest-900 font-semibold">Teleconsultation</p>
          <p className="text-sm text-forest-700">Bientot disponible sur la plateforme.</p>
        </div>
      </div>
    </div>
  )
}
