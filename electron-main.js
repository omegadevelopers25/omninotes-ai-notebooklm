const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    // Launch Express server
    const serverScript = path.join(__dirname, 'server.js');
    console.log("Starting backend Express server:", serverScript);

    // Require server directly or start child process
    try {
        require('./server.js');
    } catch (err) {
        console.error("Error starting server directly:", err.message);
    }

    // Create native Electron window
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'OmniNotes AI - NotebookLM Auto-Notes Maker',
        icon: path.join(__dirname, 'public', 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        },
        autoHideMenuBar: true,
        backgroundColor: '#0B0E14'
    });

    // Load local web app
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 1200);

    // Open external links in user default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
