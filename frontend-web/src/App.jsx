import { Routes, Route, Outlet } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import PatientLayout from './components/PatientLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Register from './pages/Register'
import Care from './pages/Care'
import PatientSearch from './pages/PatientSearch'
import Consultation from './pages/Consultation'
import PatientDashboard from './pages/PatientDashboard'
import MyInvoices from './pages/MyInvoices'
import Pharmacy from './pages/Pharmacy'
import Laboratory from './pages/Laboratory'
import PatientMessages from './pages/PatientMessages'
import Profile from './pages/Profile'
import DoctorProfile from './pages/DoctorProfile'
import EstablishmentAdmin from './pages/EstablishmentAdmin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import SupportChat from './pages/SupportChat'

/**
 * NOUVEAU (refonte visuelle SpeedSante+): les pages publiques/partagees
 * gardent la barre de navigation classique en haut. Le portail patient
 * authentifie utilise desormais son propre menu lateral (PatientLayout) -
 * voir plus bas, un groupe de routes distinct, sans cette barre du haut.
 */
function PublicShell() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <Outlet />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/soins" element={<Care />} />
        <Route path="/rechercher" element={<PatientSearch />} />
        <Route path="/medecin/:doctorId" element={<DoctorProfile />} />
        <Route path="/profil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route
          path="/super-admin"
          element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>}
        />
        <Route path="/support" element={<ProtectedRoute><SupportChat /></ProtectedRoute>} />
      </Route>

      {/* EstablishmentAdmin a deja son propre menu lateral integre (voir
          SidebarLayout dans le composant) - pas de barre supplementaire ici. */}
      <Route
        path="/admin-etablissement"
        element={<ProtectedRoute allowedRoles={['establishment_admin']}><EstablishmentAdmin /></ProtectedRoute>}
      />

      {/* Portail patient: menu lateral fixe, conforme aux maquettes de
          reference - remplace la barre du haut pour toutes ces pages. */}
      <Route element={<ProtectedRoute allowedRoles={['patient']}><PatientLayout /></ProtectedRoute>}>
        <Route path="/espace-patient" element={<PatientDashboard />} />
        <Route path="/mes-factures" element={<MyInvoices />} />
        <Route path="/consultation" element={<Consultation />} />
        <Route path="/pharmacie" element={<Pharmacy />} />
        <Route path="/laboratoire" element={<Laboratory />} />
        <Route path="/messages" element={<PatientMessages />} />
      </Route>
    </Routes>
  )
}
