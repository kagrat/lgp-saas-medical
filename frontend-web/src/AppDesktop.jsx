import { Routes, Route } from 'react-router-dom'
import DesktopNavbar from './components/DesktopNavbar'
import ProtectedRoute from './components/ProtectedRoute'
import DesktopLogin from './pages-desktop/DesktopLogin'
import DesktopDoctorDashboard from './pages-desktop/DesktopDoctorDashboard'
import DesktopPharmacistDashboard from './pages-desktop/DesktopPharmacistDashboard'
import DesktopLabTechDashboard from './pages-desktop/DesktopLabTechDashboard'
import DesktopSecretaryDashboard from './pages-desktop/DesktopSecretaryDashboard'
import DesktopSupportChat from './pages-desktop/DesktopSupportChat'
import EstablishmentAdmin from './pages/EstablishmentAdmin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Profile from './pages/Profile'

/**
 * Point d'entree DEDIE a l'application Desktop.
 *
 * Chaque role du personnel a desormais son propre espace, fonctionnellement
 * teste un par un: Admin etablissement, Super Admin, Medecin, Pharmacien,
 * Technicien laboratoire, Secretariat.
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
          path="/mon-espace-pharmacie"
          element={<ProtectedRoute allowedRoles={['pharmacist']}><DesktopPharmacistDashboard /></ProtectedRoute>}
        />
        <Route
          path="/mon-espace-laboratoire"
          element={<ProtectedRoute allowedRoles={['lab_technician']}><DesktopLabTechDashboard /></ProtectedRoute>}
        />
        <Route
          path="/mon-espace-secretariat"
          element={<ProtectedRoute allowedRoles={['secretary']}><DesktopSecretaryDashboard /></ProtectedRoute>}
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
