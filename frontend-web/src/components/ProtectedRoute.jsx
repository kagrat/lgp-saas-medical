import { Navigate } from 'react-router-dom'
import { getRole } from '../api/client'

// Meme detection runtime que api/client.js - l'app Desktop n'a pas de
// route /connexion, son ecran de connexion est a la racine "/".
const LOGIN_PATH = (typeof window !== 'undefined' && window.__LGP_CLIENT_TYPE__ === 'desktop') ? '/' : '/connexion'

export default function ProtectedRoute({ allowedRoles, children }) {
  const role = getRole()
  if (!role) return <Navigate to={LOGIN_PATH} replace />
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to={LOGIN_PATH} replace />
  return children
}
