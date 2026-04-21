const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        title: "TG TECH - Sistema de Facturación POS",
        icon: path.join(__dirname, 'TGTECH.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Deshabilitar menú superior para un look de aplicación POS limpia
    win.setMenuBarVisibility(false);

    // Manejador de selección de dispositivo Bluetooth (Auto-conectar)
    win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
        event.preventDefault();
        if (deviceList.length > 0) {
            callback(deviceList[0].deviceId); // Conecta automáticamente al primero encontrado
        }
    });

    win.webContents.session.setBluetoothPairingHandler((details, callback) => {
        callback({ action: 'proceed' });
    });

    win.loadFile('index.html');

    // Maximizar al iniciar
    win.maximize();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
