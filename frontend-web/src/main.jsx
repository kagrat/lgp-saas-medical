import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import MaintenanceGate from './components/MaintenanceGate.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Interrupteur de suspension d'acces (voir MaintenanceGate.jsx): eteint par defaut. */}
    <MaintenanceGate>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MaintenanceGate>
  </React.StrictMode>,
)
