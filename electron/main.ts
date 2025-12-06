import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path from 'path'

// The built directory structure
//
// ├─┬─ dist
// │ ├─ index.html
// │ ├─ assets
// │ └─ ...
// ├─┬─ dist-electron
// │ ├─ main.js
// │ └─ preload.js
//
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let overlayWin: BrowserWindow | null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
    win = new BrowserWindow({
        width: 320,
        height: 480,
        minWidth: 280,
        minHeight: 400,
        maxWidth: 500,
        maxHeight: 700,
        alwaysOnTop: true,
        resizable: true,
        frame: true, // Manter frame para facilitar movimentação
        icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    // Configurar Content Security Policy (CSP) para segurança
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline'", // unsafe-inline necessário para React
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
                    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
                    "img-src 'self' data: https:",
                    "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.supabase.co wss://*.supabase.co https://cotwpinplanner.app",
                    "frame-src 'none'",
                    "object-src 'none'",
                    "base-uri 'self'"
                ].join('; ')
            }
        });
    });

    // Remover menu bar completamente
    win.setMenuBarVisibility(false)

    // Test active push message to Electron-Renderer.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(process.env.DIST, 'index.html'))
    }
}

// IPC for Overlay
ipcMain.handle('toggle-overlay', (_event, show: boolean) => {
    if (show) {
        if (!overlayWin) {
            overlayWin = new BrowserWindow({
                width: 300,
                height: 200,
                frame: false,
                transparent: true,
                alwaysOnTop: true,
                resizable: true,
                webPreferences: {
                    preload: path.join(__dirname, 'preload.js'),
                    nodeIntegration: false,
                    contextIsolation: true,
                },
            })

            // Load the overlay route
            const url = VITE_DEV_SERVER_URL
                ? `${VITE_DEV_SERVER_URL}#/overlay`
                : path.join(process.env.DIST, 'index.html') + '#/overlay' // Hash routing for overlay

            if (VITE_DEV_SERVER_URL) {
                overlayWin.loadURL(url)
            } else {
                overlayWin.loadFile(path.join(process.env.DIST, 'index.html'), { hash: 'overlay' })
            }

            overlayWin.on('closed', () => {
                overlayWin = null
            })
        } else {
            overlayWin.show()
        }
        // Minimize main window?
        // win?.minimize()
    } else {
        overlayWin?.close()
        overlayWin = null
        win?.show()
    }
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(() => {
    createWindow()

    // Registrar atalhos globais (funcionam mesmo quando o app não está em foco)
    // ATENÇÃO: Esses atalhos funcionam GLOBALMENTE no sistema!

    // Ctrl+Shift+= para incrementar (+1)
    globalShortcut.register('CommandOrControl+Shift+=', () => {
        console.log('Global hotkey: +1 kill')
        win?.webContents.send('hotkey-increment')
    })

    // Ctrl+Shift+- para decrementar (-1)
    globalShortcut.register('CommandOrControl+Shift+-', () => {
        console.log('Global hotkey: -1 kill')
        win?.webContents.send('hotkey-decrement')
    })

    // Ctrl+Shift+S para abrir estatísticas
    globalShortcut.register('CommandOrControl+Shift+S', () => {
        console.log('Global hotkey: Open stats')
        win?.webContents.send('hotkey-stats')
    })
})

// Cleanup: Desregistrar atalhos quando o app fecha
app.on('will-quit', () => {
    globalShortcut.unregisterAll()
})
