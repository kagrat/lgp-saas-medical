import axios from 'axios'

// L'URL de l'API se configure via une variable d'environnement Vite.
// En developpement: cree un fichier .env dans frontend-web/ avec
// VITE_API_URL=http://localhost:8000
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
    const wasLoggedIn = !!localStorage.getItem('lgp_token')

    if (isAuthFailure && wasLoggedIn) {
      // CORRECTIF: avant, on redirigeait brutalement sans explication -
      // l'utilisateur voyait juste "error 401" affiche tel quel. Desormais
      // on nettoie la session et on redirige vers la connexion avec un
      // message clair, plutot que de laisser l'erreur brute remonter.
      localStorage.removeItem('lgp_token')
      localStorage.removeItem('lgp_role')
      localStorage.removeItem('lgp_establishment_id')
      sessionStorage.setItem('lgp_session_expired', '1')
      window.location.href = '/connexion'
      // On ne rejette pas l'erreur plus loin: la redirection prend le relais,
      // ca evite qu'un composant tente d'afficher ce 401 brut a l'ecran.
      return new Promise(() => {})
    }

    return Promise.reject(error)
  }
)

export function saveSession(token, role, establishmentId) {
  localStorage.setItem('lgp_token', token)
  localStorage.setItem('lgp_role', role)
  if (establishmentId) localStorage.setItem('lgp_establishment_id', establishmentId)
}

export function clearSession() {
  localStorage.removeItem('lgp_token')
  localStorage.removeItem('lgp_role')
  localStorage.removeItem('lgp_establishment_id')
}

export function getRole() {
  return localStorage.getItem('lgp_role')
}

/** Vrai une seule fois juste apres une redirection causee par une session expiree. */
export function consumeSessionExpiredFlag() {
  const wasExpired = sessionStorage.getItem('lgp_session_expired') === '1'
  sessionStorage.removeItem('lgp_session_expired')
  return wasExpired
}

/**
 * Convertit une erreur d'API en texte affichable, quelle que soit sa forme.
 */
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
