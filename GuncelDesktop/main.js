const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const database = require('./database');

// Ensure AppUserModelID for correct taskbar/exe icon on Windows
try {
  app.setAppUserModelId && app.setAppUserModelId('com.satinalma.rapor');
} catch (e) {
  // ignore if not supported in this environment
}

// Ensure app.name uses proper Unicode to avoid Alt-Tab encoding issues on Windows
try {
  app.name = 'Sat\u0131n Alma Rapor Sistemi';
} catch (e) {
  // ignore
}

// Menu bar'i kaldir
Menu.setApplicationMenu(null);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    title: 'Sat\u0131n Alma Rapor Sistemi',
    backgroundColor: '#f5f6f7',
    show: false,
    frame: false,
    autoHideMenuBar: true,
    fullscreen: true,
    simpleFullscreen: true,
    kiosk: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Pencere hazir oldugunda fullscreen goster
  mainWindow.once('ready-to-show', () => {
    mainWindow.setFullScreen(true);
    mainWindow.show();
  });

  // Development modunda DevTools'u ac
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window Control IPC Handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(false);
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.setFullScreen(true);
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

// IPC Handlers
ipcMain.handle('get-data', async (event, query) => {
  try {
    const result = await database.executeQuery(query);
    return { success: true, data: result };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-data', async () => {
  try {
    const result = await database.getAllData();
    return { success: true, data: result };
  } catch (error) {
    console.error('getAllData error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-dashboard-stats', async (event, ambarFilter) => {
  try {
    const result = await database.getDashboardStats(ambarFilter);
    return { success: true, data: result };
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-ambar-list', async () => {
  try {
    const result = await database.getAmbarList();
    return { success: true, data: result };
  } catch (error) {
    console.error('getAmbarList error:', error);
    return { success: false, error: error.message };
  }
});
