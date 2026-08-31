import { Link } from 'react-router-dom'
import { Video } from 'lucide-react'

const CATEGORIES = [
  { to: '/consultation', label: 'Médecins', description: 'Consultations dans les hopitaux et cliniques adherents', image: '/images/doctor-consultation.jpg' },
  { to: '/pharmacie', label: 'Pharmacies', description: 'Medicaments disponibles pres de chez toi', image: '/images/pharmacy-shelves.jpg' },
  { to: '/laboratoire', label: 'Laboratoires', description: 'Analyses medicales et resultats', image: '/images/lab-equipment.jpg' },
]

/**
 * NOUVEAU (demande M. Faustin): page d'accueil par defaut du portail
 * patient, une fois connecte - reprend le contenu de la page "Soins"
 * (Care.jsx) mais SANS l'etiqueter comme tel, puisque c'est desormais
 * l'accueil naturel plutot qu'une page distincte nommee "Soins".
 */
export default function PatientHome() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Que cherches-tu ?</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {CATEGORIES.map(({ to, label, description, image }) => (
          <Link
            key={to} to={to}
            className="group relative overflow-hidden rounded-2xl h-64 hover:shadow-lg transition"
          >
            <img
              src={image}
              alt={label}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <span className="font-display text-lg text-white font-semibold block mb-1">{label}</span>
              <span className="text-sm text-white/85">{description}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-forest-100 bg-primary-50 p-6 flex items-center gap-4">
        <span className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
          <Video className="w-6 h-6 text-primary-700" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-display text-lg text-forest-900 font-semibold">Teleconsultation</p>
          <p className="text-sm text-forest-700">Bientot disponible sur la plateforme.</p>
        </div>
      </div>
    </div>
  )
}
