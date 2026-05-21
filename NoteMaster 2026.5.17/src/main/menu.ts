import { BrowserWindow, Menu, MenuItemConstructorOptions, app, dialog } from 'electron';

export function createAppMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin';
  const send = (channel: string, ...args: unknown[]) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    }
  };

  const template: MenuItemConstructorOptions[] = [
    // macOS 应用菜单
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // 文件菜单
    {
      label: '文件',
      submenu: [
        {
          label: '新建笔记',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('menu:new-note'),
        },
        {
          label: '新建文件夹',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => send('menu:new-folder'),
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('menu:save'),
        },
        {
          label: '全部保存',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('menu:save-all'),
        },
        { type: 'separator' },
        {
          label: '导入',
          click: () => send('menu:import'),
        },
        {
          label: '导出',
          submenu: [
            {
              label: '导出为PDF',
              click: () => send('menu:export', 'pdf'),
            },
            {
              label: '导出为HTML',
              click: () => send('menu:export', 'html'),
            },
            {
              label: '导出为图片',
              click: () => send('menu:export', 'image'),
            },
          ],
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: '查找',
          accelerator: 'CmdOrCtrl+F',
          click: () => send('menu:find'),
        },
        {
          label: '替换',
          accelerator: 'CmdOrCtrl+H',
          click: () => send('menu:replace'),
        },
      ],
    },
    // 视图菜单
    {
      label: '视图',
      submenu: [
        {
          label: '编辑模式',
          accelerator: 'CmdOrCtrl+1',
          click: () => send('menu:view', 'edit'),
        },
        {
          label: '预览模式',
          accelerator: 'CmdOrCtrl+2',
          click: () => send('menu:view', 'preview'),
        },
        {
          label: '分屏模式',
          accelerator: 'CmdOrCtrl+3',
          click: () => send('menu:view', 'split'),
        },
        { type: 'separator' },
        {
          label: '知识图谱',
          accelerator: 'CmdOrCtrl+G',
          click: () => send('menu:graph'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // 工具菜单
    {
      label: '工具',
      submenu: [
        {
          label: 'AI摘要',
          click: () => send('menu:ai-summary'),
        },
        {
          label: '知识点提取',
          click: () => send('menu:ai-extract'),
        },
        {
          label: '语法检查',
          click: () => send('menu:ai-check'),
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('menu:settings'),
        },
      ],
    },
    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 NoteMaster',
          click: () => {
            if (!mainWindow.isDestroyed()) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '关于 NoteMaster',
                message: `NoteMaster v${app.getVersion()}`,
                detail: 'AI增强的Markdown学习笔记管理工具',
              });
            }
          },
        },
        {
          label: '使用教程',
          click: () => send('menu:help'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
