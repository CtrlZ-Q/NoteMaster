/**
 * 文件夹服务层 — 通过 IPC 调用 main process DB
 */

import { Folder } from '../types';

const api = () => window.electronAPI;

export async function createFolder(name: string, parentId?: string | null): Promise<Folder> {
  return api().folderCreate({ name, parentId: parentId ?? null });
}

export async function getFolders(parentId?: string | null): Promise<Folder[]> {
  return api().folderGetAll(parentId);
}

export async function updateFolder(
  id: string,
  updates: Partial<Pick<Folder, 'name' | 'parentId' | 'icon' | 'color' | 'sortOrder'>>,
): Promise<Folder | null> {
  return api().folderUpdate(id, updates as Record<string, unknown>);
}

export async function deleteFolder(id: string): Promise<void> {
  return api().folderDelete(id);
}
