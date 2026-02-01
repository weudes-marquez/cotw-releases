import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import koffi from 'koffi'

// Load user32.dll for low-level input
const user32 = koffi.load('user32.dll')
const GetAsyncKeyState = user32.func('int16_t __stdcall GetAsyncKeyState(int vKey)')

// Virtual Key Codes
const VK_ADD = 0x6B      // Numpad +
const VK_SUBTRACT = 0x6D // Numpad -
const VK_S = 0x53        // 'S' key
const VK_H = 0x48        // 'H' key
const VK_G = 0x47        // 'G' key
const VK_SHIFT = 0x10
const VK_CONTROL = 0x11
const VK_MENU = 0x12     // Alt
const VK_D = 0x44        // 'D' key
const VK_N = 0x4E        // 'N' key

let pollingInterval: NodeJS.Timeout | null = null
import log from 'electron-log'

import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Prevent Chromium from slowing down the app when it's behind the game
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
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
let settingsWin: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createSettingsWindow() {
    if (settingsWin) {
        settingsWin.focus()
        return
    }

    // Calculate position next to main window
    let x = undefined
    let y = undefined
    const winWidth = 380
    const winHeight = 600

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

    settingsWin = new BrowserWindow({
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
        ? `${VITE_DEV_SERVER_URL}#/settings`
        : path.join(process.env.DIST!, 'index.html') + '#/settings'

    if (VITE_DEV_SERVER_URL) {
        settingsWin.loadURL(url)
    } else {
        settingsWin.loadFile(path.join(process.env.DIST!, 'index.html'), { hash: 'settings' })
    }

    settingsWin.on('closed', () => {
        settingsWin = null
    })
}

ipcMain.on('open-hotkey-settings', () => {
    createSettingsWindow()
})

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
        console.log('🔴 Main window closed - Shutting down all windows')

        // Close all other windows when main window is closed
        BrowserWindow.getAllWindows().forEach(w => {
            if (w !== win && !w.isDestroyed()) {
                w.destroy()
            }
        })

        win = null
        app.quit() // Force app to quit when main window is gone
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
    createSettingsWindow();
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
    if (win) {
        // Se as opções incluírem { forward: true }, usamos o comportamento padrão (ignora tudo)
        // Se não, usamos o comportamento de 'clicar através apenas de áreas transparentes'
        if (options && options.forward) {
            win.setIgnoreMouseEvents(ignore, { forward: true })
        } else {
            win.setIgnoreMouseEvents(ignore)
        }
    }
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

// Helper to map accelerator strings to Virtual Key codes (Windows)
function parseAccelerator(acc: string): number[] {
    if (!acc) return []
    const parts = acc.toLowerCase().split('+')
    const codes: number[] = []

    const vkMapping: Record<string, number> = {
        'alt': 0x12, 'shift': 0x10, 'ctrl': 0x11, 'control': 0x11, 'meta': 0x5B, 'command': 0x5B, 'cmd': 0x5B,
        'space': 0x20, 'enter': 0x0D, 'return': 0x0D, 'tab': 0x09, 'escape': 0x1B, 'esc': 0x1B, 'backspace': 0x08,
        'insert': 0x2D, 'delete': 0x2E, 'home': 0x24, 'end': 0x23, 'pageup': 0x21, 'pagedown': 0x22,
        'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27,
        'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74, 'f6': 0x75, 'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79, 'f11': 0x7A, 'f12': 0x7B,
        'numadd': 0x6B, 'numsub': 0x6D, 'nummult': 0x6A, 'numdiv': 0x6F, 'numdec': 0x6E,
        'num0': 0x60, 'num1': 0x61, 'num2': 0x62, 'num3': 0x63, 'num4': 0x64, 'num5': 0x65, 'num6': 0x66, 'num7': 0x67, 'num8': 0x68, 'num9': 0x69,
        'plus': 0xBB, '=': 0xBB, 'minus': 0xBD, '-': 0xBD, '[': 0xDB, '{': 0xDB, ']': 0xDD, '}': 0xDD,
        ';': 0xBA, ':': 0xBA, '/': 0xBF, '?': 0xBF, '`': 0xC0, '~': 0xC0, '\\': 0xDC, '|': 0xDC, '\'': 0xDE, '"': 0xDE, ',': 0xBC, '<': 0xBC, '.': 0xBE, '>': 0xBE,
        'capslock': 0x14, 'scrolllock': 0x91, 'numlock': 0x90, 'abnt_c1': 0xC1, 'abnt_c2': 0xC2
    };

    parts.forEach(part => {
        const p = part.trim()
        if (vkMapping[p]) {
            codes.push(vkMapping[p])
        } else if (p.length === 1) {
            const charCode = p.toUpperCase().charCodeAt(0)
            if ((charCode >= 65 && charCode <= 90) || (charCode >= 48 && charCode <= 57)) {
                codes.push(charCode)
            }
        }
    })
    return Array.from(new Set(codes)) // Remove duplicates
}

// Hotkey management
let currentHotkeys: Record<string, string> = {
    increment: 'numadd',
    decrement: 'numsub',
    stats: 'Alt+Shift+S',
    tray: 'Alt+Shift+G',
    overlay: 'Alt+Shift+H',
    detailedStats: 'Alt+Shift+]',
    needZones: 'Alt+Shift+['
};

function startNativePolling() {
    console.log('🚀 [Main] Starting Dynamic Native Polling...')
    if (pollingInterval) clearInterval(pollingInterval)

    // State tracking for edge detection per action
    let keyStates: Record<string, boolean> = {
        increment: false,
        decrement: false,
        stats: false,
        overlay: false,
        tray: false,
        detailedStats: false,
        needZones: false
    }

    // Reset loop if hotkeys change to avoid "stuck" states
    ipcMain.on('update-hotkeys-reset-poller', () => {
        Object.keys(keyStates).forEach(key => keyStates[key] = false);
    });

    pollingInterval = setInterval(() => {
        try {
            const checkAction = (action: string, accelerator: string, callback: () => void) => {
                const vkCodes = parseAccelerator(accelerator)
                if (vkCodes.length === 0) return

                // Checked if ALL keys in the accelerator are currently pressed
                const isDown = vkCodes.every(code => {
                    // Especial: Tecla '/' pode ser 0xBF (US) ou 0xC1 (ABNT2). 
                    // Se o código for 0xBF, aceitamos 0xC1 como equivalente.
                    if (code === 0xBF) {
                        return (GetAsyncKeyState(0xBF) & 0x8000) !== 0 || (GetAsyncKeyState(0xC1) & 0x8000) !== 0
                    }
                    return (GetAsyncKeyState(code) & 0x8000) !== 0
                })

                // Trigger only on key down transition (edge detection)
                if (isDown && !keyStates[action]) {
                    console.log(`🎯 [Native] Action Triggered: ${action} (${accelerator})`)
                    callback()
                }
                keyStates[action] = isDown
            }

            const broadcast = (channel: string) => {
                BrowserWindow.getAllWindows().forEach(w => {
                    if (!w.isDestroyed()) w.webContents.send(channel)
                })
            }

            // Dynamically check whatever is in currentHotkeys
            checkAction('increment', currentHotkeys.increment, () => broadcast('hotkey-increment'))
            checkAction('decrement', currentHotkeys.decrement, () => broadcast('hotkey-decrement'))
            checkAction('stats', currentHotkeys.stats, () => broadcast('hotkey-stats'))

            checkAction('overlay', currentHotkeys.overlay, () => {
                if (overlayWin && !overlayWin.isDestroyed()) {
                    closeOverlay()
                } else {
                    createOverlayWindow()
                }
            })

            checkAction('tray', currentHotkeys.tray, () => {
                if (win) {
                    toggleTray()
                }
            })

            checkAction('detailedStats', currentHotkeys.detailedStats, () => {
                if (detailedStatsWin && !detailedStatsWin.isDestroyed()) {
                    detailedStatsWin.close()
                } else {
                    createDetailedStatsWindow()
                }
            })

            checkAction('needZones', currentHotkeys.needZones, () => {
                if (needZonesWin && !needZonesWin.isDestroyed()) {
                    needZonesWin.close()
                    needZonesWin = null
                } else {
                    broadcast('hotkey-need-zones')
                }
            })
        } catch (e) {
            // Silence polling errors
        }
    }, 50)
}

function registerGlobalHotkeys(customHotkeys?: Record<string, string>) {
    if (customHotkeys) {
        currentHotkeys = { ...currentHotkeys, ...customHotkeys }
        console.log('🔄 [Main] Hotkeys updated for poller:', currentHotkeys)
    }
}

app.whenReady().then(() => {
    createWindow()
    registerGlobalHotkeys()
    startNativePolling()

    // IPC to update hotkeys from settings
    ipcMain.on('update-hotkeys', (_event, newHotkeys) => {
        console.log('🔄 Updating global hotkeys:', newHotkeys)
        registerGlobalHotkeys(newHotkeys)
        // Reset poller state for the new hotkeys
        BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed()) w.webContents.send('update-hotkeys-reset-poller')
        });
        // We also trigger a local reset if we are in the same process (poller is in main)
        // Actually, let's just emit an IPC event to ourselves
        ipcMain.emit('update-hotkeys-reset-poller');
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

    // HUD Controls
    ipcMain.on('toggle-hud-edit', (_event, enabled) => {
        if (overlayWin && !overlayWin.isDestroyed()) {
            overlayWin.webContents.send('toggle-hud-edit', enabled)
        }
    })

    ipcMain.on('update-hud-scale', (_event, scale) => {
        if (overlayWin && !overlayWin.isDestroyed()) {
            overlayWin.webContents.send('update-hud-scale', scale)
        }
    })

    // Sync settings between windows
    ipcMain.on('settings-updated', (_event, settings) => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('sync-settings', settings)
        }
    })

    // Reset All Stats Trigger
    ipcMain.on('reset-all-stats', () => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('trigger-reset-stats')
        }
    })

    // Reset window positions
    ipcMain.on('reset-windows', () => {
        console.log('🔄 Resetting window positions...')
        const primaryDisplay = screen.getPrimaryDisplay()
        const { width, height } = primaryDisplay.workAreaSize

        // Center main window
        if (win && !win.isDestroyed()) {
            win.setBounds({
                x: Math.floor((width - WINDOW_WIDTH) / 2),
                y: Math.floor((height - 520) / 2),
                width: WINDOW_WIDTH,
                height: 520
            }, true)
            win.setAlwaysOnTop(true, 'screen-saver')
            win.show()
        }

        // Handle other windows if they are open
        const otherWindows = [detailedStatsWin, settingsWin, needZonesWin]
        otherWindows.forEach(w => {
            if (w && !w.isDestroyed()) {
                const bounds = w.getBounds()
                w.setBounds({
                    x: Math.floor((width - bounds.width) / 2) + 20, // Slightly offset so they don't stack perfectly
                    y: Math.floor((height - bounds.height) / 2) + 20,
                    width: bounds.width,
                    height: bounds.height
                }, true)
                w.show()
                w.focus()
            }
        })
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
