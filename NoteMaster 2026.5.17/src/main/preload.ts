import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 对话框
  openFile: (options?: object) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options?: object) => ipcRenderer.invoke('dialog:saveFile', options),

  // 文件操作
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('file:write', filePath, content),

  // 应用信息
  getUserData: () => ipcRenderer.invoke('app:getUserData'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // --- 笔记 DB 操作 ---
  noteGetById: (id: string) => ipcRenderer.invoke('db:note:getById', id),
  noteGetAll: (filter: Record<string, unknown>) => ipcRenderer.invoke('db:note:getAll', filter),
  noteCreate: (data: { title: string; folderId?: string | null; content?: string }) =>
    ipcRenderer.invoke('db:note:create', data),
  noteUpdate: (id: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('db:note:update', { id, updates }),
  noteDelete: (id: string) => ipcRenderer.invoke('db:note:delete', id),
  notePermanentDelete: (id: string) => ipcRenderer.invoke('db:note:permanentDelete', id),
  noteRestore: (id: string) => ipcRenderer.invoke('db:note:restore', id),
  noteMove: (noteId: string, folderId: string | null) =>
    ipcRenderer.invoke('db:note:move', { noteId, folderId }),
  noteToggleFavorite: (id: string) => ipcRenderer.invoke('db:note:toggleFavorite', id),
  noteSetTags: (noteId: string, tagIds: string[]) =>
    ipcRenderer.invoke('db:note:setTags', { noteId, tagIds }),

  // --- 文件夹 DB 操作 ---
  folderGetAll: (parentId?: string | null) => ipcRenderer.invoke('db:folder:getAll', parentId),
  folderCreate: (data: { name: string; parentId?: string | null }) =>
    ipcRenderer.invoke('db:folder:create', data),
  folderUpdate: (id: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('db:folder:update', { id, updates }),
  folderDelete: (id: string) => ipcRenderer.invoke('db:folder:delete', id),

  // --- 标签 DB 操作 ---
  tagGetAll: () => ipcRenderer.invoke('db:tag:getAll'),
  tagCreate: (data: { name: string; color?: string }) =>
    ipcRenderer.invoke('db:tag:create', data),
  tagUpdate: (id: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('db:tag:update', { id, updates }),
  tagDelete: (id: string) => ipcRenderer.invoke('db:tag:delete', id),

  // AI 配置（API key 加密存储在 main process，不暴露给 renderer）
  getAIConfig: () => ipcRenderer.invoke('ai:getConfig'),
  saveAIConfig: (config: { apiKey: string; endpoint: string; model: string }) =>
    ipcRenderer.invoke('ai:saveConfig', config),
  callAI: (params: { prompt: string; content: string }) =>
    ipcRenderer.invoke('ai:call', params),

  // 菜单事件监听
  onMenuNewNote: (callback: () => void) => {
    ipcRenderer.on('menu:new-note', callback);
    return () => ipcRenderer.removeListener('menu:new-note', callback);
  },
  onMenuNewFolder: (callback: () => void) => {
    ipcRenderer.on('menu:new-folder', callback);
    return () => ipcRenderer.removeListener('menu:new-folder', callback);
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu:save', callback);
    return () => ipcRenderer.removeListener('menu:save', callback);
  },
  onMenuExport: (callback: (format: string) => void) => {
    const listener = (_: unknown, format: string) => callback(format);
    ipcRenderer.on('menu:export', listener);
    return () => ipcRenderer.removeListener('menu:export', listener);
  },
  onMenuView: (callback: (mode: string) => void) => {
    const listener = (_: unknown, mode: string) => callback(mode);
    ipcRenderer.on('menu:view', listener);
    return () => ipcRenderer.removeListener('menu:view', listener);
  },
  onMenuSaveAll: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:save-all', listener);
    return () => ipcRenderer.removeListener('menu:save-all', listener);
  },
  onMenuImport: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:import', listener);
    return () => ipcRenderer.removeListener('menu:import', listener);
  },
  onMenuFind: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:find', listener);
    return () => ipcRenderer.removeListener('menu:find', listener);
  },
  onMenuReplace: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:replace', listener);
    return () => ipcRenderer.removeListener('menu:replace', listener);
  },
  onMenuGraph: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:graph', listener);
    return () => ipcRenderer.removeListener('menu:graph', listener);
  },
  onMenuAiSummary: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:ai-summary', listener);
    return () => ipcRenderer.removeListener('menu:ai-summary', listener);
  },
  onMenuAiExtract: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:ai-extract', listener);
    return () => ipcRenderer.removeListener('menu:ai-extract', listener);
  },
  onMenuAiCheck: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:ai-check', listener);
    return () => ipcRenderer.removeListener('menu:ai-check', listener);
  },
  onMenuSettings: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:settings', listener);
    return () => ipcRenderer.removeListener('menu:settings', listener);
  },
  onMenuHelp: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:help', listener);
    return () => ipcRenderer.removeListener('menu:help', listener);
  },
});
