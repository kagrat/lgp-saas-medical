import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { StatusBadge } from './OrderStatus'

/**
 * NOUVEAU (demande explicite de M. Faustin): tableau de bord pharmacie en
 * tete de menu - 4 grands rectangles (meme style visuel que l'ancien
 * "Statistiques"), puis en dessous un raccourci des commandes en cours
 * de traitement (nombre limite, pas la liste complete).
 */
export default function PharmacyDashboard({ onSelectOrder, onNavigate }) {
  const [stats, setStats] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/pharmacy/stats'),
      api.get('/pharmacy/orders/summary'),
    ])
      .then(([statsRes, summaryRes]) => {
        setStats(statsRes.data)
        setSummary(summaryRes.data)
      })
      .catch((err) => setError(getErrorMessage(err, 'Impossible de charger le tableau de bord.')))
  }, [])

  if (error) return <p className="text-clay-600">{error}</p>
  if (!stats) return <p className="text-forest-700">Chargement...</p>

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* CORRIGE (demande explicite de M. Faustin: "la grille du tableau de
            bord de la pharmacie doit etre cliquable, pas juste figee") -
            chaque rectangle mene directement a ce qu'il compte. */}
        <StatBox label="Commandes en attente" value={stats.pending_orders} highlight={stats.pending_orders > 0}
          hint="Voir les commandes" onClick={onNavigate && (() => onNavigate('pending_orders'))} />
        <StatBox label="Livraisons en cours" value={stats.deliveries_in_progress}
          hint="Voir les livraisons" onClick={onNavigate && (() => onNavigate('deliveries'))} />
        <StatBox label="Alertes de stock" value={stats.low_stock_items} highlight={stats.low_stock_items > 0}
          hint="Voir les produits concernés" onClick={onNavigate && (() => onNavigate('stock_alerts'))} />
        <StatBox label="Chiffre d'affaires du jour" value={`${stats.revenue_today.toLocaleString('fr-FR')} FCFA`}
          hint="Voir les rapports" onClick={onNavigate && (() => onNavigate('revenue'))} />
      </div>

      <p className="text-sm font-medium text-forest-900 mb-3">Commandes en cours de traitement</p>
      {summary.length === 0 ? (
        <p className="text-forest-700 text-sm">Aucune commande en cours actuellement.</p>
      ) : (
        <div>
          {/* CORRIGE (demande explicite de M. Faustin: "la facon dont les
              commandes s'affichent dans le menu du tableau de bord soit
              comme celle du menu commandes") - meme ligne d'entete et
              memes colonnes que l'onglet Commandes, pour une presentation
              identique. */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 text-xs font-medium text-forest-700 uppercase tracking-wide">
            <span>N° commande</span>
            <span>Patient</span>
            <span>Date</span>
            <span>Statut</span>
            <span>Action</span>
          </div>
          <div className="space-y-2">
            {summary.map((o) => (
              <div key={o.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-center">
                  <span className="text-sm text-forest-900 font-medium">{o.order_number}</span>
                  <span className="text-sm text-forest-900">{o.patient_name}</span>
                  <span className="text-sm text-forest-700">{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
                  <StatusBadge status={o.status} />
                  <button
                    onClick={() => onSelectOrder && onSelectOrder(o.id)}
                    className="text-sm rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 hover:brightness-90 transition justify-self-start sm:justify-self-end"
                  >
                    Ouvrir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, highlight, hint, onClick }) {
  const classes = `rounded-xl border p-5 text-left w-full ${highlight ? 'border-clay-500 bg-clay-500/5' : 'border-forest-100 bg-white'}`
  const content = (
    <>
      <p className="text-sm text-forest-700 mb-1">{label}</p>
      <p className={`font-display text-3xl font-semibold ${highlight ? 'text-clay-600' : 'text-forest-900'}`}>{value}</p>
      {onClick && (
        <p className="text-xs text-forest-700 mt-3 flex items-center gap-1">
          {hint} <span aria-hidden="true">&rsaquo;</span>
        </p>
      )}
    </>
  )
  if (!onClick) return <div className={classes}>{content}</div>
  return (
    <button type="button" onClick={onClick} aria-label={`${label} : ${hint}`}
      className={`${classes} cursor-pointer transition hover:shadow-md hover:border-forest-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]`}>
      {content}
    </button>
  )
}
