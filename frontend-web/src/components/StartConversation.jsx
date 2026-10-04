import { useState } from 'react'

/**
 * NOUVEAU (bug reel signale par M. Faustin: "il n'y a meme pas le cadre
 * dans lequel il faut ecrire le message" - cote pharmacien, et meme
 * probleme cote medecin: "permettre au medecin d'engager la discussion
 * meme si le patient n'a pas commence"). Le serveur autorisait deja le
 * personnel a ecrire a un patient sans conversation prealable (tant qu'il
 * existe un lien reel: rendez-vous, commande, analyse) - il manquait
 * seulement un moyen, cote ecran, de CHOISIR ce patient.
 *
 * searchFn: fonction async (query) => [{ patient_id, full_name }], adaptee
 * a chaque role (mes propres patients pour un medecin, tous les patients
 * de l'etablissement pour un pharmacien/technicien labo).
 */
export default function StartConversation({ searchFn, onStart }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  async function runSearch(query) {
    setSearch(query)
    setLoading(true)
    try {
      const data = await searchFn(query)
      setResults(data)
    } catch (err) {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) runSearch('')
  }

  if (!open) {
    return (
      <button onClick={toggleOpen}
        className="rounded-full bg-[var(--portal-accent)] text-white px-4 py-2 text-sm font-medium hover:brightness-90 transition">
        + Nouvelle conversation
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-forest-100 bg-white p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-medium text-forest-900">Écrire à un patient</p>
        <button onClick={() => setOpen(false)} className="text-sm text-forest-700 hover:underline">Fermer</button>
      </div>
      <input
        autoFocus
        placeholder="Rechercher un patient..."
        value={search}
        onChange={(e) => runSearch(e.target.value)}
        className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2"
      />
      {loading && <p className="text-sm text-forest-700">Recherche...</p>}
      {!loading && results.length === 0 && <p className="text-sm text-forest-700">Aucun patient trouvé.</p>}
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {results.map((p) => (
          <button
            key={p.patient_id}
            onClick={() => { onStart(p); setOpen(false); setSearch(''); setResults([]) }}
            className="block w-full text-left rounded-lg border border-forest-100 p-2 text-sm hover:border-forest-300 transition"
          >
            {p.full_name}
          </button>
        ))}
      </div>
    </div>
  )
}
