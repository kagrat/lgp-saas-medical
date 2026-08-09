import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lgp_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthFailure = error.response && error.response.status === 401
    const previousRole = localStorage.getItem('lgp_role')
    const wasLoggedIn = !!localStorage.getItem('lgp_token')

    if (isAuthFailure && wasLoggedIn) {
      // CORRECTIF: on garde une trace du role qui vient d'expirer (staff ou
      // patient) AVANT de nettoyer la session. Ca permet a la Navbar et a
      // la page de connexion de savoir qu'un admin/etablissement vient
      // d'etre deconnecte, plutot que de basculer silencieusement sur un
      // affichage "visiteur patient" (boutons recherche medecin/pharmacie,
      // lien "creer un compte patient") qui n'a pas de sens pour quelqu'un
      // qui etait admin l'instant d'avant.
      if (previousRole) {
        sessionStorage.setItem('lgp_last_role_before_expiry', previousRole)
      }
      localStorage.removeItem('lgp_token')
      localStorage.removeItem('lgp_role')
      localStorage.removeItem('lgp_establishment_id')
      sessionStorage.setItem('lgp_session_expired', '1')
      window.location.href = '/connexion'
      return new Promise(() => {})
    }

    return Promise.reject(error)
  }
)

export function saveSession(token, role, establishmentId) {
  localStorage.setItem('lgp_token', token)
  localStorage.setItem('lgp_role', role)
  if (establishmentId) localStorage.setItem('lgp_establishment_id', establishmentId)
  // Une nouvelle connexion reussie efface la trace de l'ancienne session expiree.
  sessionStorage.removeItem('lgp_last_role_before_expiry')
}

export function clearSession() {
  localStorage.removeItem('lgp_token')
  localStorage.removeItem('lgp_role')
  localStorage.removeItem('lgp_establishment_id')
  sessionStorage.removeItem('lgp_last_role_before_expiry')
}

export function getRole() {
  return localStorage.getItem('lgp_role')
}

/**
 * Role de la session qui vient d'expirer (si applicable), sans la
 * consommer/effacer - utilise par Navbar ET Login sur le meme rendu,
 * effacee uniquement lors de la prochaine connexion reussie (saveSession).
 */
export function getLastRoleBeforeExpiry() {
  return sessionStorage.getItem('lgp_last_role_before_expiry')
}

/** Vrai une seule fois juste apres une redirection causee par une session expiree. */
export function consumeSessionExpiredFlag() {
  const wasExpired = sessionStorage.getItem('lgp_session_expired') === '1'
  sessionStorage.removeItem('lgp_session_expired')
  return wasExpired
}

export function getErrorMessage(err, fallback = 'Une erreur est survenue. Reessaie.') {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d)))
      .join(' - ')
  }
  return fallback
}

export default api
