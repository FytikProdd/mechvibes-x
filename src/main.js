const { app, BrowserWindow, Tray, Menu, shell, ipcMain } = require('electron');
const { getVolume, getMute } = require('easy-volume');
const path = require('path');
const fs = require('fs-extra');
const log = require("electron-log");
const packageJson = require('../package.json');
const Store = require("electron-store");

const APP_DISPLAY_NAME = String(packageJson.productName || packageJson.name || 'Mechvibes X')
  .trim()
  .replace(/^['"]+|['"]+$/g, '');
const user_dir = path.join(app.getPath("appData"), APP_DISPLAY_NAME);

app.setName(APP_DISPLAY_NAME);
app.setPath("userData", user_dir);

const store = new Store({ cwd: user_dir, name: 'config' });
const iohook = require('iohook');

const StartupHandler = require('./utils/startup_handler');
const StoreToggle = require('./utils/store_toggle');

const SYSTRAY_ICON = path.join(__dirname, '/assets/system-tray-icon.png');
const custom_dir = path.join(user_dir, '/custom');
const current_pack_store_id = 'mechvibes-pack';

const mute = new StoreToggle("mechvibes-muted", false);
const start_minimized = new StoreToggle("mechvibes-start-minimized", false);
const active_volume = new StoreToggle("mechvibes-active-volume", true);
const random_pitch = new StoreToggle("mechvibes-random-pitch", false);

log.transports.file.fileName = "mechvibes.log";
log.transports.file.level = "info";
log.transports.file.resolvePath = (variables) => {
  return path.join(variables.libraryDefaultDir, variables.fileName);
}
log.variables.sender = "main";
log.transports.console.format = "%c{h}:{i}:{s}.{ms}%c {sender} › {text}"
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]({sender}) {text}"

const LogTransportMap = { error: 'red', warn: 'yellow', info: 'cyan', debug: 'magenta', silly: 'green', default: 'unset' };
log.hooks.push((msg, { transportName }) => {
  if (transportName === 'console') {
    return {
      ...msg,
      data: [`color: ${LogTransportMap[msg.level]}`, 'color: unset', ...msg.data]
    };
  }
  return msg;
});

var win = null;
var tray = null;
global.app_version = app.getVersion();
global.user_dir = user_dir;
global.custom_dir = custom_dir;
global.current_pack_store_id = current_pack_store_id;
fs.ensureDirSync(custom_dir);

function createWindow(show = false) {
  win = new BrowserWindow({
    name: "app",
    width: 400,
    height: 600,
    webSecurity: false,
    webPreferences: {
      preload: path.join(__dirname, 'app.js'),
      contextIsolation: false,
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    show: false,
  });

  win.removeMenu();
  win.loadFile('./src/app.html');

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("ava-toggle", active_volume.is_enabled);
    win.webContents.send("mechvibes-mute-status", mute.is_enabled);
    win.webContents.send("random-pitch-toggle", random_pitch.is_enabled);
  })

  win.on('closed', function () {
    win = null;
  });

  win.on('close', function (event) {
    if (!app.isQuiting) {
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
      event.preventDefault();
      win.hide();
    }
    return false;
  });

  win.on("unresponsive", () => {
    log.warn("Window has entered unresponsive state");
  })

  if (show) {
    win.show();
  } else {
    win.close();
  }

  return win;
}

const gotTheLock = app.requestSingleInstanceLock();
app.on('second-instance', () => {
  if (win) {
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    win.show();
    win.focus();
  }
});

if (!gotTheLock) {
  app.quit();
} else {

  app.on('ready', () => {
    log.silly("Ready event has fired.");
    const startup_handler = new StartupHandler(app);

    log.silly("Creating main window for the first time...");
    if(startup_handler.was_started_at_login && start_minimized.is_enabled){
      win = createWindow(false);
    }else{
      win = createWindow(true);
    }

    if(!mute.is_enabled){
      iohook.start();
    }

    let volume = -1;
    let system_mute = false;
    let system_volume_error = false;
    let sys_check_interval = setInterval(() => {
      if(!mute.is_enabled){
        getVolume().then((v) => {
          if(v !== volume){
            volume = v;
            win.webContents.send("system-volume-update", volume);
          }
        }).catch((err) => {
          clearInterval(sys_check_interval);
          if(err == "" && !system_volume_error){
            system_volume_error = true;
          }
          log.error(`Volume Error: ${err}`);
        });

        getMute().then((m) => {
          if(m !== system_mute){
            system_mute = m;
            win.webContents.send("system-mute-status", system_mute);
          }
        }).catch((err) => {
          clearInterval(sys_check_interval);
          if(err == "" && !system_volume_error){
            system_volume_error = true;
            app.exit(1);
          }
          log.error(`Mute Error: ${err}`);
        });
      }
    }, 3000);

    iohook.on('keydown', (event) => {
      win.webContents.send("keydown", event);
    });

    iohook.on('keyup', (event) => {
      win.webContents.send("keyup", event);
    });

    function buildContextMenu(){
      return Menu.buildFromTemplate([
        {
          label: 'Mechvibes X',
          click: function () {
            if (process.platform === 'darwin') {
              app.dock.show();
            }
            win.show();
            win.focus();
          },
        },
        {
          label: 'Editor',
          click: function () {
            openEditorWindow();
          },
        },
        {
          label: 'Folders',
          submenu: [
            {
              label: 'Custom Soundpacks',
              click: function () {
                shell.openPath(custom_dir).then((err) => {
                  if(err){
                    log.error(err);
                  }
                });
              },
            },
            {
              label: 'Application Data',
              click: function () {
                shell.openPath(user_dir).then((err) => {
                  if(err){
                    log.error(err);
                  }
                });
              },
            },
          ],
        },
        {
          label: 'Mute',
          type: 'checkbox',
          checked: mute.is_enabled,
          click: function () {
            mute.toggle();
            if(!mute.is_enabled){
              iohook.start();
            }else{
              iohook.stop();
            }
            win.webContents.send("mechvibes-mute-status", mute.is_enabled);
          },
        },
        {
          label: 'Extras',
          submenu: [
            {
              label: 'Enable at Startup',
              type: 'checkbox',
              checked: startup_handler.is_enabled,
              click: function () {
                startup_handler.toggle();
              },
            },
            {
              label: 'Start Minimized',
              type: 'checkbox',
              checked: start_minimized.is_enabled,
              click: function () {
                start_minimized.toggle();
              },
            },
            {
              label: 'Active Volume Adjustment',
              type: 'checkbox',
              checked: active_volume.is_enabled,
              click: function () {
                active_volume.toggle();
                win.webContents.send("ava-toggle", active_volume.is_enabled);
              },
            },
            {
              label: 'Random Pitch & Volume',
              type: 'checkbox',
              checked: random_pitch.is_enabled,
              click: function () {
                random_pitch.toggle();
                win.webContents.send("random-pitch-toggle", random_pitch.is_enabled);
              },
            },
          ],
        },
        {
          label: 'Quit',
          click: function () {
            clearInterval(sys_check_interval);
            app.isQuiting = true;
            app.quit();
          },
        },
      ]);
    }

    function createTrayIcon(){
      if(tray !== null) return;

      tray = new Tray(SYSTRAY_ICON);
      tray.setToolTip('Mechvibes X');

      const contextMenu = buildContextMenu();

      if(process.platform == "darwin"){
        tray.on('click', () => {
          tray.popUpContextMenu(contextMenu);
        });

        tray.on("right-click", () => {
          app.dock.show();
          win.show();
          win.focus();
        })
      }else{
        tray.setContextMenu(contextMenu);
        tray.on("double-click", () => {
          win.show();
          win.focus();
        })
      }
    }

    function updateTrayMenu() {
      if (tray === null) return;
      const contextMenu = buildContextMenu();
      if (process.platform !== 'darwin') {
        tray.setContextMenu(contextMenu);
      }
    }

    ipcMain.on("random-pitch-change", (event, enabled) => {
      if (enabled) {
        random_pitch.enable();
      } else {
        random_pitch.disable();
      }
      updateTrayMenu();
    });

    ipcMain.on("show_tray_icon", (event, show) => {
      if(show && tray === null){
        createTrayIcon();
      }else if(!show && tray !== null){
        tray.destroy()
        tray = null;
      }else if(!show && tray === null){
        createTrayIcon();
      }
    })

    ipcMain.on("electron-log", (event, message, level) => {
      const window_options = event.sender.browserWindowOptions;
      if(window_options.name !== undefined && typeof window_options.name == "string"){
        log.variables.sender = window_options.name
      }else{
        log.variables.sender = "u/w"; // unknown window
      }
      log[level](message);
      log.variables.sender = "main"; // reset sender
    })

    log.debug(`Platform: ${process.platform}`);
    log.info("App is ready and has been initialized");

    if (process.platform == 'darwin') {
      const { powerMonitor } = require('electron');
      powerMonitor.on('shutdown', () => {
        app.quit();
      });
    }
  });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.on('window-all-closed', function () {
  log.silly("All windows were closed.");
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  log.silly("App has been activated")
  if (win === null){
    createWindow(true);
  }else{
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  }
});

app.on("before-quit", () => {
  log.silly("Shutting down...");
});

app.on('quit', () => {
  log.silly("Goodbye.");
  app.quit();
});

var editor_window = null;

function openEditorWindow() {
  if (editor_window) {
    editor_window.focus();
    return;
  }

  editor_window = new BrowserWindow({
    width: 1200,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  editor_window.loadFile('./src/editor.html');

  editor_window.on('closed', function () {
    editor_window = null;
  });
}
