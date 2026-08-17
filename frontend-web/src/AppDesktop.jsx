import { Routes, Route } from 'react-router-dom'
import DesktopNavbar from './components/DesktopNavbar'
import ProtectedRoute from './components/ProtectedRoute'
import DesktopLogin from './pages-desktop/DesktopLogin'
import DesktopDoctorDashboard from './pages-desktop/DesktopDoctorDashboard'
import DesktopSupportChat from './pages-desktop/DesktopSupportChat'
import EstablishmentAdmin from './pages/EstablishmentAdmin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Profile from './pages/Profile'

/**
 * Point d'entree DEDIE a l'application Desktop. Ne reference jamais
 * PatientSearch, Pharmacy, Laboratory, PatientDashboard, Register, Care ou
 * PatientMessages - ce code n'existe donc tout simplement pas dans le
 * fichier JavaScript final envoye a l'app Desktop.
 *
 * CORRECTIF: ajoute la route dediee aux medecins (/mon-espace-medecin) -
 * jusqu'ici, un compte medecin etait redirige vers /admin-etablissement,
 * une page reservee aux admins, et se faisait systematiquement rejeter.
 */
export default function AppDesktop() {
  return (
    <div className="min-h-screen bg-paper">
      <DesktopNavbar />
      <Routes>
        <Route path="/desktop.html" element={<DesktopLogin />} />
        <Route path="/" element={<DesktopLogin />} />
        <Route
          path="/admin-etablissement"
          element={<ProtectedRoute allowedRoles={['establishment_admin']}><EstablishmentAdmin /></ProtectedRoute>}
        />
        <Route
          path="/mon-espace-medecin"
          element={<ProtectedRoute allowedRoles={['doctor']}><DesktopDoctorDashboard /></ProtectedRoute>}
        />
        <Route
          path="/super-admin"
          element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/support"
          element={<ProtectedRoute><DesktopSupportChat /></ProtectedRoute>}
        />
        <Route
          path="/profil"
          element={<ProtectedRoute><Profile /></ProtectedRoute>}
        />
        <Route path="*" element={<DesktopLogin />} />
      </Routes>
    </div>
  )
}
