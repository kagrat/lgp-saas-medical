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
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('lgp_token')
      localStorage.removeItem('lgp_role')
      window.location.href = '/connexion'
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

/**
 * Convertit une erreur d'API en texte affichable, quelle que soit sa forme.
 * BUG CORRIGE: les erreurs de validation (422) renvoient une LISTE d'objets
 * ({loc, msg, type}), pas une chaine de texte. Essayer d'afficher cette liste
 * directement dans du JSX ({error}) fait planter silencieusement l'affichage
 * (page figee, ecran blanc) - c'est ce qui causait les blocages a la creation
 * d'un etablissement avec latitude/longitude invalides.
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
