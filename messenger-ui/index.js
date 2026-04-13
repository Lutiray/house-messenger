const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');
const{ spawn } = require('child_process');
const path = require('path');

let mainWindow;
let cppClient;

function startCppClient() {
    const exePath = "C:\\Рабочий стол\\messenger\\messenger-client\\build\\Debug\\messenger-client.exe";
    const exeDir = path.dirname(exePath);

    if (cppClient) {
        console.log("Killing existing C++ client...");
        cppClient.kill();
        cppClient = null;
    }

    if (fs.existsSync(exePath)) {
        console.log("Starting C++ Executable...");
        cppClient = spawn(exePath, [], { cwd: exeDir });

        cppClient.stdout.on('data', (data) => {
            const str = data.toString().trim();
            console.log("C++ Output:", str);
            if (mainWindow) {
                mainWindow.webContents.send('from-cpp', str);
            }
        });

        cppClient.stderr.on('data', (data) => {
            console.error("C++ Error:", data.toString());
        });

        cppClient.on('close', (code) => {
            console.log(`C++ Client exited with code ${code}`);
        });
    } else {
        console.error("CRITICAL ERROR: C++ Executable NOT FOUND at:", exePath);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration : true,
            contextIsolation: false,
            nodeIntegrationInWorker: true
        }
    });

    mainWindow.loadFile("src/index.html");
    mainWindow.webContents.openDevTools();

    startCppClient();
}

ipcMain.on('to-cpp', (event, arg) => {
    if (cppClient && cppClient.stdin.writable) {
        cppClient.stdin.write(arg + "\n");
    }
});

ipcMain.on('restart-app', () => {
    console.log("Restarting UI and C++ Client...");
    startCppClient();
    mainWindow.reload();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (cppClient) {
        cppClient.kill();
        cppClient = null;
    }
});

app.whenReady().then(createWindow);
