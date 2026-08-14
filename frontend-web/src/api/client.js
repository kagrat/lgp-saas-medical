import axios from 'axios'

/**
 * Client API unique, "conscient" de sa cible (web ou desktop). Detection
 * a l'execution (pas a la compilation): les deux applications sont
 * construites en un seul passage Vite (voir vite.config.js, deux points
 * d'entree html), donc une variable d'environnement classique serait
 * identique pour les deux. Chaque fichier HTML pose son propre marqueur
 * (voir desktop.html) que ce fichier lit au demarrage.
 */
const CLIENT_TYPE = (typeof window !== 'undefined' && window.__LGP_CLIENT_TYPE__) || 'web'
const STORAGE_PREFIX = CLIENT_TYPE === 'desktop' ? 'lgp_desktop_' : 'lgp_'
const LOGIN_PATH = CLIENT_TYPE === 'desktop' ? '/' : '/connexion'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'X-Client-Type': CLIENT_TYPE },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(`${STORAGE_PREFIX}token`)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthFailure = error.response && error.response.status === 401
    const previousRole = localStorage.getItem(`${STORAGE_PREFIX}role`)
    const wasLoggedIn = !!localStorage.getItem(`${STORAGE_PREFIX}token`)

    if (isAuthFailure && wasLoggedIn) {
      if (previousRole) {
        sessionStorage.setItem(`${STORAGE_PREFIX}last_role_before_expiry`, previousRole)
      }
      localStorage.removeItem(`${STORAGE_PREFIX}token`)
      localStorage.removeItem(`${STORAGE_PREFIX}role`)
      localStorage.removeItem(`${STORAGE_PREFIX}establishment_id`)
      sessionStorage.setItem(`${STORAGE_PREFIX}session_expired`, '1')
      window.location.href = LOGIN_PATH
      return new Promise(() => {})
    }
    return Promise.reject(error)
  }
)

export function saveSession(token, role, establishmentId) {
  localStorage.setItem(`${STORAGE_PREFIX}token`, token)
  localStorage.setItem(`${STORAGE_PREFIX}role`, role)
  if (establishmentId) localStorage.setItem(`${STORAGE_PREFIX}establishment_id`, establishmentId)
  sessionStorage.removeItem(`${STORAGE_PREFIX}last_role_before_expiry`)
}

export function clearSession() {
  localStorage.removeItem(`${STORAGE_PREFIX}token`)
  localStorage.removeItem(`${STORAGE_PREFIX}role`)
  localStorage.removeItem(`${STORAGE_PREFIX}establishment_id`)
  sessionStorage.removeItem(`${STORAGE_PREFIX}last_role_before_expiry`)
}

export function getRole() {
  return localStorage.getItem(`${STORAGE_PREFIX}role`)
}

export function getLastRoleBeforeExpiry() {
  return sessionStorage.getItem(`${STORAGE_PREFIX}last_role_before_expiry`)
}

export function consumeSessionExpiredFlag() {
  const wasExpired = sessionStorage.getItem(`${STORAGE_PREFIX}session_expired`) === '1'
  sessionStorage.removeItem(`${STORAGE_PREFIX}session_expired`)
  return wasExpired
}

export function getErrorMessage(err, fallback = 'Une erreur est survenue. Reessaie.') {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(' - ')
  }
  return fallback
}

export default api
