import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
let needZonesWin: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
    console.log('🔵 Creating main window...')
    win = new BrowserWindow({
        width: 480, // Login screen width
        height: 640, // Login screen height
        minWidth: 340,
        minHeight: 450,
        maxWidth: 550,
        maxHeight: 750,
        alwaysOnTop: true,
        resizable: true,
        frame: false, // Remove native borders as requested
        // transparent: true, // DISABLED temporarily for debugging
        backgroundColor: '#1c1917', // stone-900
        icon: path.join(__dirname, '../build/icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
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

    console.log('🔵 Window created, loading URL...')

    // Test active push message to Electron-Renderer.
    win.webContents.on('did-finish-load', () => {
        console.log('🟢 Page loaded successfully!')
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error('🔴 Failed to load:', errorCode, errorDescription)
    })

    win.on('closed', () => {
        console.log('🔴 Main window closed')
        win = null
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(process.env.DIST, 'index.html'))
    }
}

// Helper to create Overlay Window
function createOverlayWindow() {
    if (overlayWin) return

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.bounds

    overlayWin = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    // Load the overlay route
    const url = VITE_DEV_SERVER_URL
        ? `${VITE_DEV_SERVER_URL}#/overlay`
        : path.join(process.env.DIST, 'index.html') + '#/overlay'

    if (VITE_DEV_SERVER_URL) {
        overlayWin.loadURL(url)
    } else {
        overlayWin.loadFile(path.join(process.env.DIST, 'index.html'), { hash: 'overlay' })
    }

    overlayWin.on('closed', () => {
        overlayWin = null
    })
}

// Helper to close Overlay and auxiliary windows
function closeOverlay() {
    if (overlayWin) {
        overlayWin.close()
        overlayWin = null
    }
    // Fecha também a janela de Need Zones se estiver aberta
    if (needZonesWin) {
        needZonesWin.close()
        needZonesWin = null
    }

    // Garante que a janela principal apareça se necessário (opcional, mas bom pra UX)
    win?.show()
}

// IPC for Overlay
ipcMain.handle('toggle-overlay', (_event, show?: boolean) => {
    // Se 'show' for undefined, inverte o estado atual
    const shouldShow = show !== undefined ? show : !overlayWin

    if (shouldShow) {
        if (!overlayWin) {
            createOverlayWindow()
        } else {
            overlayWin.show()
        }
    } else {
        closeOverlay()
    }
})

// IPC to control mouse pass-through for Overlay
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.setIgnoreMouseEvents(ignore, { forward: true })
})

// IPC for resizing window (e.g., for Login screen)
ipcMain.on('resize-window', (_event, width, height) => {
    if (win && !isRetracted) {
        win.setSize(width, height)
        win.center()
    }
})

// IPC for toggle tray
ipcMain.on('toggle-tray', () => {
    toggleTray()
})

// IPC for opening Need Zones window
ipcMain.on('open-need-zones', () => {
    if (needZonesWin) {
        needZonesWin.focus()
        return
    }

    const mainBounds = win?.getBounds()
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workAreaSize

    const newWindowWidth = 800
    const newWindowHeight = 600

    let x = 0
    let y = 0

    let position = 'right'
    if (mainBounds) {
        y = mainBounds.y
        const spaceOnRight = screenWidth - (mainBounds.x + mainBounds.width)
        if (spaceOnRight >= newWindowWidth) {
            x = mainBounds.x + mainBounds.width
            position = 'right'
        } else {
            x = mainBounds.x - newWindowWidth
            position = 'left'
        }
    }

    needZonesWin = new BrowserWindow({
        width: newWindowWidth,
        height: newWindowHeight,
        x,
        y,
        title: 'Need Zones',
        frame: false,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: '#1c1917',
    })

    needZonesWin.setAlwaysOnTop(true, 'screen-saver')
    needZonesWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    needZonesWin.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline'",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
                    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
                    "img-src 'self' data: https:",
                    "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.supabase.co wss://*.supabase.co https://cotwpinplanner.app",
                    "frame-src 'none'",
                    "object-src 'none'",
                    "base-uri 'self'"
                ].join('; ')
            }
        })
    })

    const url = VITE_DEV_SERVER_URL
        ? `${VITE_DEV_SERVER_URL}#/need-zones/${position}`
        : `file://${path.join(process.env.DIST!, 'index.html')}#/need-zones/${position}`

    needZonesWin.loadURL(url)

    needZonesWin.on('closed', () => {
        needZonesWin = null
    })
})

// IPC for opening user guide
let guideWin: BrowserWindow | null = null
ipcMain.on('open-user-guide', () => {
    if (guideWin) {
        guideWin.focus()
        return
    }

    guideWin = new BrowserWindow({
        width: 900,
        height: 700,
        alwaysOnTop: false,
        frame: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    const url = VITE_DEV_SERVER_URL
        ? `${VITE_DEV_SERVER_URL}#/guide`
        : path.join(process.env.DIST, 'index.html') + '#/guide'

    if (VITE_DEV_SERVER_URL) {
        guideWin.loadURL(url)
    } else {
        guideWin.loadFile(path.join(process.env.DIST!, 'index.html'), { hash: 'guide' })
    }

    guideWin.on('closed', () => {
        guideWin = null
    })
})

// Tray state variables
let isRetracted = false
const WINDOW_WIDTH = 360
const RETRACTED_WIDTH = 20

// Function to retract window
function retractWindow() {
    if (!win || isRetracted) return

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    win.setBounds({
        x: screenWidth - RETRACTED_WIDTH,
        y: Math.floor((screenHeight - 520) / 2),
        width: WINDOW_WIDTH,
        height: 520
    }, true)

    isRetracted = true
    win.webContents.send('tray-state-changed', true)
}

// Function to expand window
function expandWindow() {
    if (!win || !isRetracted) return

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    win.setBounds({
        x: screenWidth - WINDOW_WIDTH - 20,
        y: Math.floor((screenHeight - 520) / 2),
        width: WINDOW_WIDTH,
        height: 520
    }, true)

    isRetracted = false
    win.webContents.send('tray-state-changed', false)
}

// Toggle tray
function toggleTray() {
    if (isRetracted) {
        expandWindow()
    } else {
        retractWindow()
    }
}

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

    // Alt+Shift+= para incrementar (+1)
    globalShortcut.register('Alt+Shift+=', () => {
        console.log('Global hotkey: +1 kill')
        win?.webContents.send('hotkey-increment')
    })

    // Alt+Shift+- para decrementar (-1)
    globalShortcut.register('Alt+Shift+-', () => {
        console.log('Global hotkey: -1 kill')
        win?.webContents.send('hotkey-decrement')
    })

    // Alt+Shift+S para abrir estatísticas
    globalShortcut.register('Alt+Shift+S', () => {
        console.log('Global hotkey: Open stats')
        win?.webContents.send('hotkey-stats')
    })

    // Alt+Shift+G para expandir bandeja se estiver retraída
    globalShortcut.register('Alt+Shift+G', () => {
        console.log('Global hotkey: Toggle tray')
        if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
            if (isRetracted) expandWindow()
        }
    })

    // Alt+Shift+H para Toggle HUD (Overlay)
    globalShortcut.register('Alt+Shift+H', () => {
        console.log('Global hotkey: Toggle HUD')
        // Lógica de toggle direto aqui
        if (overlayWin) {
            closeOverlay()
        } else {
            createOverlayWindow()
        }
    })

    // Check for updates
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify()
    }
})

// Cleanup: Desregistrar atalhos quando o app fecha
app.on('will-quit', () => {
    globalShortcut.unregisterAll()
})

// Auto-updater logging
autoUpdater.logger = log
// @ts-ignore
autoUpdater.logger.transports.file.level = 'info'

autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...')
})

autoUpdater.on('update-available', (info) => {
    log.info('Update available.', info)
})

autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.', info)
})

autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err)
})

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')'
    log.info(log_message)
})

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded', info)
})
