import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.disableHardwareAcceleration()

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
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST!, '../public')

let win: BrowserWindow | null
let overlayWin: BrowserWindow | null
let needZonesWin: BrowserWindow | null = null
let detailedStatsWin: BrowserWindow | null = null
let hotkeySettingsWin: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createHotkeySettingsWindow() {
    if (hotkeySettingsWin) {
        hotkeySettingsWin.focus()
        return
    }

    // Calculate position next to main window
    let x = undefined
    let y = undefined
    const winWidth = 360
    const winHeight = 520

    if (win) {
        const winBounds = win.getBounds()
        const display = screen.getDisplayMatching(winBounds)
        const workArea = display.workArea

        // Try to open to the right
        x = winBounds.x + winBounds.width + 10

        // If it would go off-screen to the right, try opening to the left
        if (x + winWidth > workArea.x + workArea.width) {
            x = winBounds.x - winWidth - 10
        }

        // Ensure it's within work area (clamping)
        x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - winWidth))
        y = Math.max(workArea.y, Math.min(winBounds.y, workArea.y + workArea.height - winHeight))
    }

    hotkeySettingsWin = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x,
        y,
        frame: false,
        alwaysOnTop: true,
        backgroundColor: '#1c1917',
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    const url = VITE_DEV_SERVER_URL
        ? `${VITE_DEV_SERVER_URL}#/hotkeys`
        : path.join(process.env.DIST!, 'index.html') + '#/hotkeys'

    if (VITE_DEV_SERVER_URL) {
        hotkeySettingsWin.loadURL(url)
    } else {
        hotkeySettingsWin.loadFile(path.join(process.env.DIST!, 'index.html'), { hash: 'hotkeys' })
    }

    hotkeySettingsWin.on('closed', () => {
        hotkeySettingsWin = null
    })
}

function createWindow() {
    console.log('🔵 Creating main window...')
    win = new BrowserWindow({
        width: 480, // Login screen width
        height: 640, // Match login screen height for smoother start
        minWidth: 340,
        minHeight: 450,
        maxWidth: 550,
        maxHeight: 850,
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

    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    win.on('focus', () => {
        win?.setAlwaysOnTop(true, 'screen-saver')
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
        win.loadFile(path.join(process.env.DIST!, 'index.html'))
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
        focusable: false, // Prevent stealing focus
        skipTaskbar: true, // Don't show in taskbar
        show: false, // Show only when ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    overlayWin.setAlwaysOnTop(true, 'screen-saver')
    overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Only show when ready to avoid flickering
    overlayWin.once('ready-to-show', () => {
        overlayWin?.showInactive() // Show without taking focus
    })

    // Load the overlay route
    const url = VITE_DEV_SERVER_URL
        ? `${VITE_DEV_SERVER_URL}#/overlay`
        : path.join(process.env.DIST!, 'index.html') + '#/overlay'

    if (VITE_DEV_SERVER_URL) {
        overlayWin.loadURL(url)
    } else {
        overlayWin.loadFile(path.join(process.env.DIST!, 'index.html'), { hash: 'overlay' })
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

let isDetailedStatsClosing = false;

function createDetailedStatsWindow() {
    if (detailedStatsWin && !detailedStatsWin.isDestroyed()) {
        if (isDetailedStatsClosing) return; // Don't focus if it's closing
        detailedStatsWin.focus();
        return;
    }

    detailedStatsWin = null;
    isDetailedStatsClosing = false;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = primaryDisplay.workArea;

    const winWidth = 900;
    const winHeight = screenHeight;

    detailedStatsWin = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: screenX + screenWidth - winWidth,
        y: screenY - winHeight, // Start off-screen (top)
        frame: false,
        alwaysOnTop: true,
        backgroundColor: '#1c1917',
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true,
        show: false,
    });

    detailedStatsWin.setAlwaysOnTop(true, 'screen-saver')
    detailedStatsWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    detailedStatsWin.on('focus', () => {
        detailedStatsWin?.setAlwaysOnTop(true, 'screen-saver')
    })

    if (VITE_DEV_SERVER_URL) {
        detailedStatsWin.loadURL(`${VITE_DEV_SERVER_URL}#/detailed-stats`);
    } else {
        detailedStatsWin.loadFile(path.join(process.env.DIST!, 'index.html'), { hash: 'detailed-stats' });
    }

    detailedStatsWin.once('ready-to-show', () => {
        if (!detailedStatsWin) return;
        detailedStatsWin.show();

        // Slide down animation
        let currentY = screenY - winHeight;
        const targetY = screenY;
        const step = 40;

        const animateIn = setInterval(() => {
            if (!detailedStatsWin) {
                clearInterval(animateIn);
                return;
            }
            currentY += step;
            if (currentY >= targetY) {
                currentY = targetY;
                clearInterval(animateIn);
            }
            detailedStatsWin.setBounds({ x: screenX + screenWidth - winWidth, y: currentY, width: winWidth, height: winHeight });
        }, 10);
    });

    // Handle slide up on close
    detailedStatsWin.on('close', (e) => {
        if (isDetailedStatsClosing) return;
        e.preventDefault();
        isDetailedStatsClosing = true;

        let currentY = detailedStatsWin!.getBounds().y;
        const targetY = screenY - winHeight;
        const step = 40;

        const animateOut = setInterval(() => {
            if (!detailedStatsWin) {
                clearInterval(animateOut);
                return;
            }
            currentY -= step;
            if (currentY <= targetY) {
                currentY = targetY;
                clearInterval(animateOut);
                detailedStatsWin.destroy();
                detailedStatsWin = null;
                isDetailedStatsClosing = false;
            } else {
                detailedStatsWin.setBounds({ x: screenX + screenWidth - winWidth, y: currentY, width: winWidth, height: winHeight });
            }
        }, 10);
    });
}

// IPC Handlers
ipcMain.handle('open-detailed-stats', () => {
    createDetailedStatsWindow();
});

ipcMain.on('open-hotkey-settings', () => {
    createHotkeySettingsWindow();
});

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

    // Calculate position next to main window
    let x = undefined
    let y = undefined

    if (win) {
        const winBounds = win.getBounds()
        const display = screen.getDisplayMatching(winBounds)
        const workArea = display.workArea

        // Try to open to the right
        x = winBounds.x + winBounds.width + 10
        y = winBounds.y

        // If it would go off-screen to the right, try opening to the left
        if (x + 900 > workArea.x + workArea.width) {
            x = winBounds.x - 900 - 10
        }

        // Ensure it's within work area
        x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - 900))
        y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - 700))
    }

    guideWin = new BrowserWindow({
        width: 900,
        height: 700,
        x,
        y,
        alwaysOnTop: false,
        frame: false, // Remove system borders
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    guideWin.setMenuBarVisibility(false) // Remove menu bar

    const url = VITE_DEV_SERVER_URL
        ? `${VITE_DEV_SERVER_URL}#/guide`
        : path.join(process.env.DIST!, 'index.html') + '#/guide'

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
let lastWindowBounds: Electron.Rectangle | null = null
const WINDOW_WIDTH = 360
const RETRACTED_WIDTH = 20

// Function to retract window
function retractWindow() {
    if (!win || isRetracted) return

    // Store current bounds before retracting
    lastWindowBounds = win.getBounds()

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    win.setBounds({
        x: screenWidth - RETRACTED_WIDTH,
        y: lastWindowBounds.y, // Keep the same vertical position
        width: WINDOW_WIDTH,
        height: lastWindowBounds.height // Keep the same height
    }, true)

    win.setResizable(false) // Disable resizing when retracted
    isRetracted = true
    win.webContents.send('tray-state-changed', true)
}

// Function to expand window
function expandWindow() {
    if (!win || !isRetracted) return

    if (lastWindowBounds) {
        // Restore to previous position and size
        win.setBounds(lastWindowBounds, true)
    } else {
        // Fallback if no previous bounds stored
        const primaryDisplay = screen.getPrimaryDisplay()
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
        win.setBounds({
            x: screenWidth - WINDOW_WIDTH - 20,
            y: Math.floor((screenHeight - 520) / 2),
            width: WINDOW_WIDTH,
            height: 520
        }, true)
    }

    win.setResizable(true) // Re-enable resizing when expanded
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

// Hotkey management
let currentHotkeys: Record<string, string> = {
    increment: 'numadd',
    decrement: 'numsub',
    stats: 'Alt+Shift+S',
    tray: 'Alt+Shift+G',
    overlay: 'Alt+Shift+H'
}

function registerGlobalHotkeys(customHotkeys?: Record<string, string>) {
    // Unregister all first to avoid conflicts
    globalShortcut.unregisterAll()

    if (customHotkeys) {
        currentHotkeys = { ...currentHotkeys, ...customHotkeys }
    }

    // Helper to register with logging
    const register = (key: string, accelerator: string, callback: () => void) => {
        if (!accelerator) return
        try {
            const success = globalShortcut.register(accelerator, callback)
            if (success) {
                console.log(`✅ Registered hotkey: ${key} -> ${accelerator}`)
                win?.webContents.send('hotkey-status', { key, accelerator, success: true })
            } else {
                console.error(`❌ Failed to register hotkey: ${key} -> ${accelerator} (Already in use?)`)
                win?.webContents.send('hotkey-status', { key, accelerator, success: false, error: 'Already in use' })
            }
        } catch (err: any) {
            console.error(`❌ Error registering hotkey ${key}:`, err)
            win?.webContents.send('hotkey-status', { key, accelerator, success: false, error: err.message })
        }
    }

    // Register each action
    register('increment', currentHotkeys.increment, () => {
        win?.webContents.send('hotkey-increment')
    })

    register('decrement', currentHotkeys.decrement, () => {
        win?.webContents.send('hotkey-decrement')
    })

    register('stats', currentHotkeys.stats, () => {
        win?.webContents.send('hotkey-stats')
    })

    register('tray', currentHotkeys.tray, () => {
        if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
            if (isRetracted) expandWindow()
        }
    })

    register('overlay', currentHotkeys.overlay, () => {
        if (overlayWin) closeOverlay()
        else createOverlayWindow()
    })
}

app.whenReady().then(() => {
    createWindow()
    registerGlobalHotkeys()

    // IPC to update hotkeys from settings
    ipcMain.on('update-hotkeys', (_event, newHotkeys) => {
        console.log('🔄 Updating global hotkeys:', newHotkeys)
        registerGlobalHotkeys(newHotkeys)
    })

    // Tray Dragging Logic
    let trayDragInterval: NodeJS.Timeout | null = null;
    ipcMain.on('tray-drag-start', (_event, offsetTop) => {
        if (trayDragInterval) clearInterval(trayDragInterval);

        trayDragInterval = setInterval(() => {
            if (!win || !isRetracted) {
                if (trayDragInterval) clearInterval(trayDragInterval);
                return;
            }
            const cursorPos = screen.getCursorScreenPoint();
            const primaryDisplay = screen.getDisplayMatching(win.getBounds());
            const { width: screenWidth, height: screenHeight, y: screenY } = primaryDisplay.workArea;

            let newY = cursorPos.y - offsetTop;

            // Clamp to screen work area
            const bounds = win.getBounds();
            newY = Math.max(screenY, Math.min(newY, screenY + screenHeight - bounds.height));

            win.setBounds({
                x: screenWidth - RETRACTED_WIDTH,
                y: newY,
                width: WINDOW_WIDTH,
                height: bounds.height
            });

            // Do NOT update lastWindowBounds here.
            // We want the window to expand back to its ORIGINAL position,
            // not where the tray was dragged to.
        }, 16); // ~60fps
    });

    ipcMain.on('tray-drag-stop', () => {
        if (trayDragInterval) {
            clearInterval(trayDragInterval);
            trayDragInterval = null;
        }
    });

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
