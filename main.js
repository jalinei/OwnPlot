/**
 * @ Licence: OwnPlot, the OwnTech data plotter. Copyright (C) 2022. Matthias Riffard & Guillaume Arthaud - OwnTech Foundation.
	Delivered under GNU Lesser General Public License Version 2.1 (https://opensource.org/licenses/LGPL-2.1)
 * @ Website: https://www.owntech.org/
 * @ Mail: owntech@laas.fr
 * @ Create Time: 2022-08-23 14:14:50
 * @ Modified by: Jean Alinei
 * @ Modified time: 2022-09-07 13:47:38
 * @ Description:
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const ejse = require('ejs-electron');
const fs = require('fs'); //file opening, reading & writing
const isDev = require('electron-is-dev'); //to know if prod or dev
const { flashFirmware, cancelFlash } = require('./scripts/flasher');

let icon;
let mcumgrBinary;

switch (process.platform) {
    case 'win32':
        icon = path.resolve(__dirname, 'assets', 'Icon.ico');
        mcumgrBinary = 'mcumgr.exe';
        break;
    case 'darwin':
        icon = path.resolve(__dirname, 'assets', 'Icon.icns');
        //app.dock.setIcon(path.resolve(__dirname, 'assets', 'Icon.png'));
        mcumgrBinary = 'mcumgr-mac';
        break;
    case 'linux':
        icon = path.resolve(__dirname, 'assets', 'Icon.png');
        mcumgrBinary = 'mcumgr';
        break;
}

const mcumgrPath = isDev
    ? path.join(__dirname, 'tools', mcumgrBinary)
    : path.join(process.resourcesPath, 'tools', mcumgrBinary);


const examplesPath = isDev
    ? path.join(__dirname, 'tools', 'examples_bin')
    : path.join(process.resourcesPath, 'tools', 'examples_bin');

let mainWindow;

function mkdirp(dir) {
    if (fs.existsSync(dir)) { return true }
    const dirname = path.dirname(dir)
    mkdirp(dirname);
    fs.mkdirSync(dir);
}

function copyFolder(sourceDir, destDir) {
    fs.readdir(sourceDir, (err, files) => {
        if (err)
            console.log(err);
        else {
            files.forEach(file => {
                if (!fs.existsSync(destDir + "/" + file)) { //if the config is already copied, do not overwrite
                    fs.copyFile(sourceDir + "/" + file, destDir + "/" + file, (err) => {
                        if (err) {
                            console.log("Error Found:", err);
                        } else {
                            console.log("file " + file + " successfully copied");
                        }
                    });
                }
            })
        }
    })
}

app.whenReady().then(() => {
    const userDataFolder = app.getPath('userData');
    const configButtonPath = path.join(userDataFolder, 'config', 'buttons');
    const configManager = require('./scripts/configManager');
    configManager.setConfigPath(configButtonPath);

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 800,
        icon: icon,
        webPreferences: {
            nodeIntegration: true, // to allow require
            contextIsolation: false, // allow use with Electron 12+
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        autoHideMenuBar: false
    });

    mkdirp(app.getPath('userData') + "/config");
    mkdirp(app.getPath('userData') + "/config/buttons");
    copyFolder(__dirname + "/config/buttons", app.getPath('userData') + "/config/buttons");

    ipcMain.on('try-load-example-config', (event, binPath) => {
        const configPath = binPath.replace(/\.bin$/i, '.json');
        if (fs.existsSync(configPath)) {
            event.sender.send('load-config', configPath);
        }
    });

    // CONFIG MANAGER IPCs
    ipcMain.handle('get-user-data-folder', async () => {
        return app.getPath('userData');
    });

    ipcMain.handle('config-list-files', async () => {
        return new Promise((resolve, reject) => {
            configManager.listConfigFiles((err, files) => {
                if (err) reject(err);
                else resolve(files);
            });
        });
    });

    ipcMain.handle('config-load', async (event, fileName) => {
        return configManager.loadConfig(fileName); // this already returns parsed JSON
    });

    ipcMain.handle('config-save', async (event, { filename, configToSave }) => {
        return new Promise((resolve, reject) => {
            try {
                configManager.saveConfig(filename, configToSave);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    });

    ipcMain.handle('config-delete', async (event, configName) => {
        return new Promise((resolve, reject) => {
            configManager.deleteConfig(configName, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    // FLASHER IPCs
    function walkTree(dir, base = '') {
        const entries = fs.readdirSync(dir);
        const result = [];

        for (const entry of entries) {
            const absPath = path.join(dir, entry);
            const relPath = path.join(base, entry);
            const stat = fs.statSync(absPath);

            if (stat.isDirectory()) {
                result.push({
                    type: 'folder',
                    name: entry,
                    children: walkTree(absPath, relPath),
                });
            } else if (entry.toLowerCase().endsWith('.bin')) {
                result.push({
                    type: 'file',
                    name: entry,
                    fullPath: absPath,
                    relativePath: relPath,
                });
            }
        }

        return result;
    }

    ipcMain.handle('get-example-bins', async () => {
        try {
            const root = examplesPath;
            return walkTree(root);
        } catch (err) {
            console.error('Error reading examples_bin:', err);
            return [];
        }
    });

    ipcMain.handle("start-flash", (event, { comPort, firmwarePath }) => {
        return new Promise((resolve) => {
            flashFirmware(
            { comPort, firmwarePath, mcumgrPath },
            (progressMessage) => {
                // Relay progress messages
                mainWindow.webContents.send("flash-progress", progressMessage);
            },
            () => {
                // Notify renderer that flashing is fully done (error or success)
                mainWindow.webContents.send("flash-complete");
            }
            );
            resolve(); // We resolve immediately; done events are separate
        });
        });

    ipcMain.on('cancel-flash', () => {
        cancelFlash();
    });

    mainWindow.loadFile(__dirname + '/index.ejs');
    //mainWindow.loadURL('file://' + __dirname + '/index.ejs')

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                width: 1250,
                height: 800,
                icon: icon,
                autoHideMenuBar: false
            }
        }
    });

    mainWindow.maximize();
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    app.quit();
})