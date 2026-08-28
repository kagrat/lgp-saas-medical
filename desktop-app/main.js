/**
 * Application Desktop LGP HOLDINGS - shell Electron.
 *
 * IMPORTANT: charge desormais /desktop.html, une application distincte du
 * portail web public (voir frontend-web/desktop.html, AppDesktop.jsx).
 * Ce n'est plus juste "la meme page web dans une fenetre" - le fichier
 * JavaScript charge ici ne contient physiquement pas le code de recherche
 * patient/pharmacie/laboratoire, uniquement les ecrans etablissement et
 * Super Admin, avec un ecran de connexion dedie et une application des
 * roles egalement verifiee cote serveur (voir backend/app/routers/auth.py).
 *
 * LIMITE HONNETE A CONNAITRE (mode hors ligne):
 * Voir la note detaillee dans le README - le vrai mode hors-ligne (base
 * locale + synchronisation) reste un chantier a part, non traite ici.
 */
const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG_PATH = path.join(app.getPath('userData'), 'establishment-config.json')

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  }
  // Par defaut, pointe vers la plateforme en production. Pour du
  // developpement local, cree ce fichier manuellement avec
  // "web_dashboard_url": "http://localhost:5173".
  return { web_dashboard_url: 'https://lgp-saas-medical.vercel.app' }
}

function createWindow() {
  const config = loadConfig()

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'LGP Console - Espace Etablissement',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL(`${config.web_dashboard_url}/desktop.html`)

  win.webContents.on('did-fail-load', () => {
    win.webContents.executeJavaScript(
      `document.body.innerHTML = '<div style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2>Connexion au serveur impossible</h2>
        <p>Verifie ta connexion internet.</p>
      </div>'`
    )
  })

  // CORRECTIF (bug reel rencontre en test): contrairement a un navigateur
  // classique, une BrowserWindow Electron nue n'a AUCUN raccourci
  // Ctrl+Shift+R cable par defaut - ce raccourci ne faisait donc
  // strictement rien avant ce correctif, ce qui a cause de la confusion
  // en test (contenu perimee du cache malgre un "rechargement force" qui
  // n'en etait pas un). On cable ici un vrai rechargement qui ignore le
  // cache, plus un raccourci clavier standard pour y acceder facilement.
  const menu = Menu.buildFromTemplate([
    {
      label: 'Affichage',
      submenu: [
        {
          label: 'Recharger (ignorer le cache)',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => win.webContents.reloadIgnoringCache(),
        },
        {
          label: 'Recharger',
          accelerator: 'CmdOrCtrl+R',
          click: () => win.webContents.reload(),
        },
        {
          label: 'Outils de developpement',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => win.webContents.toggleDevTools(),
        },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
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

ipcMain.handle('get-establishment-config', () => loadConfig())
