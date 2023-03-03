import { join } from 'node:path';

import { app, BrowserWindow, nativeTheme, shell } from 'electron';
import ElectronStore from 'electron-store';

import { IpcConstants, StoreKeys } from '../../../shared/constants';
import { AppStore } from '../../../shared/types';

export default class MainWindow {
	window: BrowserWindow;
	private store: ElectronStore<AppStore>;

	constructor(store: ElectronStore<AppStore>) {
		this.store = store;
	}

	buildWindow(indexHtml: string) {
		const windowState = this.store.get('savedWindowState');
		const webPreferences: Electron.WebPreferences = {
			webviewTag: true,
			nodeIntegration: true,
			contextIsolation: false,
		};

		if (!windowState.isTransparent) {
			webPreferences.preload = join(__dirname, '../preload/index.js');
		}

		this.window = new BrowserWindow({
			title: 'Ghost Chat',
			x: windowState.x,
			y: windowState.y,
			width: windowState.width || 400,
			height: windowState.height || 800,
			transparent: windowState.isTransparent,
			frame: false,
			resizable: true,
			maximizable: false,
			webPreferences,
		});

		this.window.setAlwaysOnTop(true, 'pop-up-menu');
		this.window.setFullScreenable(false);

		if (process.platform === 'darwin') {
			this.window.setVisibleOnAllWorkspaces(true);
			app.dock.hide();
		}

		if (windowState.x === 0 && windowState.y === 0) {
			this.window.center();
		}

		if (windowState.isClickThrough) {
			this.window.setIgnoreMouseEvents(true);
		}

		this.store.set('savedWindowState.theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
		this.store.set('settings.savedWindowState.theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

		if (process.env.VITE_DEV_SERVER_URL) {
			this.window.loadURL(process.env.VITE_DEV_SERVER_URL);
			if (!windowState.isTransparent) {
				this.window.webContents.openDevTools({
					mode: 'bottom',
				});
			}
		} else {
			this.window.loadFile(indexHtml);
		}

		this.window.webContents.on('did-finish-load', () => {
			this.window?.webContents.send(IpcConstants.GetVersion, app.getVersion());
		});

		this.window.webContents.on('will-navigate', (event, url) => {
			event.preventDefault();
			shell.openExternal(url);
		});

		this.window.on('close', () => {
			if (this.window) {
				const windowBounds = this.window.getBounds();

				this.store.set<typeof StoreKeys.SavedWindowState>('savedWindowState', {
					x: windowBounds.x,
					y: windowBounds.y,
					width: windowBounds.width,
					height: windowBounds.height,
					isClickThrough: false,
					isTransparent: false,
					theme: this.store.get('savedWindowState.theme'),
				});

				this.store.set('settings.isOpen', false);
			} else {
				this.store.reset('savedWindowState');
			}
		});

		this.window.on('closed', () => {
			if (!this.store.get('savedWindowState').isTransparent) {
				this.store.set('channelOptions.channel', '');
			}
		});
	}
}