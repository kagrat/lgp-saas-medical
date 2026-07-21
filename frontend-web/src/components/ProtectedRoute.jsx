import { Navigate } from 'react-router-dom'
import { getRole } from '../api/client'

export default function ProtectedRoute({ allowedRoles, children }) {
  const role = getRole()
  if (!role) return <Navigate to="/connexion" replace />
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />
  return children
}
