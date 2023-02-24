import { release } from 'node:os';
import { join } from 'node:path';

import { app, BrowserWindow, shell, Tray, Menu, ipcMain } from 'electron';

import { IpcConstants, StoreKeys, WindowState } from '../../shared/constants';

import createStore from './appStore';

process.env.DIST_ELECTRON = join(__dirname, '..');
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist');
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL ? join(process.env.DIST_ELECTRON, '../public') : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) {
	app.disableHardwareAcceleration();
}

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') {
	app.setAppUserModelId(app.getName());
}

if (!app.requestSingleInstanceLock()) {
	app.quit();
	process.exit(0);
}

let window: BrowserWindow | null = null;
let tray: Tray | null;

const store = createStore();

// const preload = join(__dirname, '../preload/index.js');
const indexHtml = join(process.env.DIST, 'index.html');

async function createWindow() {
	const windowState = store.get(StoreKeys.SavedWindowState);

	window = new BrowserWindow({
		title: 'Ghost Chat',
		x: windowState.x,
		y: windowState.y,
		width: windowState.width || 400,
		height: windowState.height || 800,
		transparent: windowState.isTransparent,
		frame: false,
		resizable: true,
		maximizable: false,
		webPreferences: {
			// preload,
			webviewTag: true,
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	if (process.platform !== 'darwin') {
		window.setAlwaysOnTop(true, 'pop-up-menu');
	} else {
		app.dock.hide();
		window.setAlwaysOnTop(true, 'floating');
		window.setVisibleOnAllWorkspaces(true);
		window.setFullScreenable(false);
	}

	if (windowState.x === 0 && windowState.y === 0) {
		// center the window on initial launch
		window.center();
	}

	if (process.env.VITE_DEV_SERVER_URL) {
		window.loadURL(process.env.VITE_DEV_SERVER_URL);
		window.webContents.openDevTools({
			mode: 'bottom',
		});
	} else {
		window.loadFile(indexHtml);
	}

	window.webContents.on('did-finish-load', () => {
		window?.webContents.send('get-version', app.getVersion());
	});

	// Make all links open with the browser, not with the application
	window.webContents.on('will-navigate', (event, url) => {
		event.preventDefault();
		shell.openExternal(url);
	});

	const trayIcnName = 'trayicon.png';
	const trayIcnPath = `${process.env.PUBLIC}/${trayIcnName}`;

	tray = new Tray(trayIcnPath);

	const trayIconMenu = Menu.buildFromTemplate([
		{
			label: 'Revert Vanish',
			type: 'normal',
			click: async () => {
				store.set('savedWindowState.clickThrough', false);
				store.set('savedWindowState.isTransparent', false);
				window?.setIgnoreMouseEvents(false);
				app.relaunch();
				app.exit();
			},
		},
		{
			label: 'Revert ClickThrough',
			type: 'normal',
			click: async () => {
				window?.setIgnoreMouseEvents(false);
			},
		},
		{
			label: 'Quit Ghost Chat',
			click: async () => {
				window?.close();
			},
		},
	]);

	tray?.setToolTip('Ghost Chat');
	tray?.setContextMenu(trayIconMenu);

	window.on('close', () => {
		if (window) {
			const windowBounds = window.getBounds();

			const windowState = {
				[WindowState.X]: windowBounds.x,
				[WindowState.Y]: windowBounds.y,
				[WindowState.Width]: windowBounds.width,
				[WindowState.Height]: windowBounds.height,
				[WindowState.IsClickThrough]: false,
				[WindowState.IsTransparent]: false,
			};

			store.set(StoreKeys.SavedWindowState, windowState);
		} else {
			// if the window should be null reset the window state entirely just in case
			store.reset(StoreKeys.SavedWindowState);
		}
	});

	window.on('closed', () => {
		store.set('channelOptions.channel', '');
	});
}

// ---------------------------------- ipc handling ----------------------------------

ipcMain.on(IpcConstants.Close, () => {
	window?.close();
});

ipcMain.on(IpcConstants.SetClickThrough, () => {
	window?.setIgnoreMouseEvents(true);
});

ipcMain.on(IpcConstants.Minimize, () => {
	window?.minimize();
});

ipcMain.on(IpcConstants.Vanish, () => {
	store.set('savedWindowState.isTransparent', true);
	window?.setIgnoreMouseEvents(true);
	app.relaunch();
	app.exit();
});

// New window example arg: new windows url
// ipcMain.handle('open-win', (_, arg) => {
// 	const childWindow = new BrowserWindow({
// 		webPreferences: {
// 			preload,
// 			nodeIntegration: true,
// 			contextIsolation: false,
// 		},
// 	});

// 	if (process.env.VITE_DEV_SERVER_URL) {
// 		childWindow.loadURL(`${url}#${arg}`);
// 	} else {
// 		childWindow.loadFile(indexHtml, { hash: arg });
// 	}
// });

// ---------------------------------- app handling ----------------------------------

// Let the user create a second instance for another chat
// app.on('second-instance', () => {
// 	if (window?.isMinimized()) {
// 		window.restore();
// 	}

// 	window?.focus();
// });

app.on('window-all-closed', () => {
	window = null;
	app.quit();
});

app.on('activate', async () => {
	if (window?.isMinimized()) {
		window.restore();
	} else {
		const allWindows = BrowserWindow.getAllWindows();
		if (allWindows.length) {
			allWindows[0].focus();
		} else {
			await createWindow();
		}
	}
});

app.whenReady().then(createWindow);
