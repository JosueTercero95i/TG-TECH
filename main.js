const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
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
    ipcMain.handle('generate-pdf', async (event, html, filename) => {
        const pdfWindow = new BrowserWindow({
            show: false,
            webPreferences: { offscreen: true }
        });
        try {
            await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
            const pdfData = await pdfWindow.webContents.printToPDF({
                pageSize: 'A4',
                printBackground: true,
                margins: { top: 0, bottom: 0, left: 0, right: 0 }
            });
            pdfWindow.destroy();

            const safeName = String(filename || 'Factura-TG-TECH')
                .replace(/[\\/:*?"<>|]+/g, '')
                .trim() || 'Factura-TG-TECH';
            const downloads = app.getPath('downloads');
            let filePath = path.join(downloads, `${safeName}.pdf`);
            let counter = 1;
            while (fs.existsSync(filePath)) {
                filePath = path.join(downloads, `${safeName} (${counter}).pdf`);
                counter++;
            }
            fs.writeFileSync(filePath, pdfData);
            return { canceled: false, filePath, auto: true };
        } catch (error) {
            console.error(error);
            pdfWindow.destroy();
            throw error;
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
