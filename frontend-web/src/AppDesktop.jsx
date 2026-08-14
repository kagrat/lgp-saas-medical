import { Routes, Route } from 'react-router-dom'
import DesktopNavbar from './components/DesktopNavbar'
import ProtectedRoute from './components/ProtectedRoute'
import DesktopLogin from './pages-desktop/DesktopLogin'
import EstablishmentAdmin from './pages/EstablishmentAdmin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Profile from './pages/Profile'

/**
 * Point d'entree DEDIE a l'application Desktop. Ne reference jamais
 * PatientSearch, Pharmacy, Laboratory, PatientDashboard, Register, Care ou
 * PatientMessages - ce code n'existe donc tout simplement pas dans le
 * fichier JavaScript final envoye a l'app Desktop (separation physique,
 * pas juste un masquage a l'ecran).
 */
export default function AppDesktop() {
  return (
    <div className="min-h-screen bg-paper">
      <DesktopNavbar />
      <Routes>
        <Route path="/" element={<DesktopLogin />} />
        <Route
          path="/admin-etablissement"
          element={<ProtectedRoute allowedRoles={['establishment_admin']}><EstablishmentAdmin /></ProtectedRoute>}
        />
        <Route
          path="/super-admin"
          element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/profil"
          element={<ProtectedRoute><Profile /></ProtectedRoute>}
        />
      </Routes>
    </div>
  )
}
