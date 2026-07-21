/**
 * Application Desktop LGP HOLDINGS - shell Electron.
 *
 * PRINCIPE: cette application ne reimplemente pas l'interface admin
 * etablissement. Elle charge le meme portail web (src/pages/EstablishmentAdmin.jsx)
 * empaquete, ce qui correspond au "60-70% de code reutilisable" mentionne
 * dans le cahier des charges pour l'appli mobile, et s'applique tout autant
 * au desktop.
 *
 * LIMITE HONNETE A CONNAITRE (mode hors ligne):
 * Le cahier des charges demande une app "adaptee aux coupures internet au
 * Benin" / "fonctionne HORS LIGNE". Un vrai mode offline-first (ecriture
 * locale + file d'attente de synchronisation + resolution de conflits)
 * est un chantier a part entiere - ce n'est pas quelque chose qu'on peut
 * cabler de maniere fiable en un seul fichier sans base locale (SQLite/
 * better-sqlite3) et sans tester de vrais scenarios de coupure reseau.
 * Ce shell fournit uniquement:
 *   - la detection en ligne/hors ligne (evenement transmis au renderer),
 *   - un point d'extension clair (voir setupOfflineQueue ci-dessous)
 * L'implementation complete de la file de synchronisation est a faire
 * dans une iteration dediee, avec de vrais tests de coupure reseau.
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG_PATH = path.join(app.getPath('userData'), 'establishment-config.json')

function loadEstablishmentConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  }
  // Config par defaut - a completer via l'ecran de configuration au premier lancement.
  // establishment_id: identifiant unique fourni par LGP HOLDINGS a la creation
  // de l'etablissement (voir POST /establishments cote Super Admin).
  return { establishment_id: null, api_url: 'http://localhost:8000', web_dashboard_url: 'http://localhost:5173' }
}

function createWindow() {
  const config = loadEstablishmentConfig()

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'LGP Sante - Poste Etablissement',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // En developpement: pointe vers le serveur Vite (npm run dev dans frontend-web/).
  // En production: remplacer par le build statique du portail (npm run build),
  // servi localement ou packagee dans l'app (voir README section Desktop).
  win.loadURL(`${config.web_dashboard_url}/admin-etablissement`)

  win.webContents.on('did-fail-load', () => {
    win.webContents.executeJavaScript(
      `document.body.innerHTML = '<div style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2>Connexion au serveur impossible</h2>
        <p>Verifie ta connexion internet ou que le serveur backend est demarre.</p>
      </div>'`
    )
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Point d'extension pour la synchronisation hors ligne (voir note en tete de fichier).
ipcMain.handle('get-establishment-config', () => loadEstablishmentConfig())
