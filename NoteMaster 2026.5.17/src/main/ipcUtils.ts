import { ipcMain } from 'electron';

/**
 * 创建独立的 IPC channel 注册表，避免不同模块共用同一个 Set 导致误删
 */
export function createChannelRegistry() {
  const channels = new Set<string>();

  function safeHandle(channel: string, handler: (...args: any[]) => any): void {
    // removeHandler + handle 都是同步操作，Node 单线程下无间隙
    if (channels.has(channel)) {
      ipcMain.removeHandler(channel);
    }
    ipcMain.handle(channel, handler);
    channels.add(channel);
  }

  function removeAll(): void {
    for (const channel of channels) {
      ipcMain.removeHandler(channel);
    }
    channels.clear();
  }

  return { safeHandle, removeAll };
}
