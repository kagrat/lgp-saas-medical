import { Routes, Route } from 'react-router-dom'
import DesktopNavbar from './components/DesktopNavbar'
import ProtectedRoute from './components/ProtectedRoute'
import DesktopLogin from './pages-desktop/DesktopLogin'
import EstablishmentAdmin from './pages/EstablishmentAdmin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Profile from './pages/Profile'

/**
 * Point d'entree DEDIE a l'application Desktop.
 *
 * CORRECTIF: quand on charge directement l'adresse ".../desktop.html",
 * React Router voit "/desktop.html" comme chemin reel (pas "/") - sans
 * route qui correspond exactement, rien ne s'affiche (page blanche, sans
 * erreur). On fait donc correspondre "/desktop.html" ET "/" au meme
 * ecran de connexion (le second sert aux navigations internes via
 * navigate('/'), le premier au tout premier chargement de la page).
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
          path="/super-admin"
          element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>}
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
