import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Care from './pages/Care'
import PatientSearch from './pages/PatientSearch'
import Consultation from './pages/Consultation'
import PatientDashboard from './pages/PatientDashboard'
import Pharmacy from './pages/Pharmacy'
import Laboratory from './pages/Laboratory'
import PatientMessages from './pages/PatientMessages'
import Profile from './pages/Profile'
import DoctorProfile from './pages/DoctorProfile'
import EstablishmentAdmin from './pages/EstablishmentAdmin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import SupportChat from './pages/SupportChat'

export default function App() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/soins" element={<Care />} />
        <Route path="/rechercher" element={<PatientSearch />} />
        <Route path="/consultation" element={<Consultation />} />
        <Route path="/pharmacie" element={<Pharmacy />} />
        <Route path="/laboratoire" element={<Laboratory />} />
        <Route path="/medecin/:doctorId" element={<DoctorProfile />} />
        <Route
          path="/espace-patient"
          element={<ProtectedRoute allowedRoles={['patient']}><PatientDashboard /></ProtectedRoute>}
        />
        <Route
          path="/messages"
          element={<ProtectedRoute allowedRoles={['patient']}><PatientMessages /></ProtectedRoute>}
        />
        <Route
          path="/profil"
          element={<ProtectedRoute><Profile /></ProtectedRoute>}
        />
        <Route
          path="/admin-etablissement"
          element={<ProtectedRoute allowedRoles={['establishment_admin']}><EstablishmentAdmin /></ProtectedRoute>}
        />
        <Route
          path="/super-admin"
          element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/support"
          element={<ProtectedRoute><SupportChat /></ProtectedRoute>}
/>
      </Routes>
    </div>
  )
}
