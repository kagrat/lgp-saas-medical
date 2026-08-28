import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import AppDesktop from './AppDesktop.jsx'
import './index.css'

// CORRECTIF (bug reel decouvert en test): avec BrowserRouter, naviguer vers
// par ex. "/admin-etablissement" faisait litteralement afficher cette URL
// dans la barre d'adresse. Un vrai rechargement (Ctrl+R) demandait alors
// cette URL directement au serveur Vercel, dont la regle de reecriture
// generique renvoie tout chemin non reconnu vers index.html (l'app PATIENT,
// pas desktop.html). Avec HashRouter, l'URL reellement demandee au serveur
// reste toujours exactement "/desktop.html" (le routage devient
// "/desktop.html#/admin-etablissement" - la partie apres # n'est jamais
// envoyee au serveur), donc un rechargement retombe toujours correctement
// sur l'application etablissement, quel que soit l'ecran affiche.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppDesktop />
    </HashRouter>
  </React.StrictMode>,
)
