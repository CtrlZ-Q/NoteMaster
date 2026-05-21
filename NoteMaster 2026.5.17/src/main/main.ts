import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { setupIpcHandlers, removeIpcHandlers } from './ipcHandlers';
import { registerDbHandlers, removeDbHandlers } from './dbHandlers';
import { initDatabase, closeDatabase } from './db';
import { createAppMenu } from './menu';

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'NoteMaster',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hidden',
    show: false,
  });

  // 开发模式加载dev server，生产模式加载本地文件
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:9000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 窗口准备好后显示，避免白屏闪烁
  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
      removeIpcHandlers();
    }
  });

  return win;
}

// 应用准备就绪
app.whenReady().then(() => {
  // 初始化数据库（在 renderer 请求前准备好）
  initDatabase(app.getPath('userData'));
  registerDbHandlers();

  mainWindow = createWindow();
  createAppMenu(mainWindow);
  setupIpcHandlers(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      createAppMenu(mainWindow);
      setupIpcHandlers(mainWindow);
    }
  });

  app.on('before-quit', () => {
    removeDbHandlers();
    removeIpcHandlers();
    closeDatabase();
  });
});

// 所有窗口关闭时退出（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 安全策略：限制新窗口创建，允许外部链接
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});
