/**
 * 标签服务层 — 通过 IPC 调用 main process DB
 */

import { Tag } from '../types';

const api = () => window.electronAPI;

export async function createTag(name: string, color?: string): Promise<Tag> {
  return api().tagCreate({ name, color });
}

export async function getAllTags(): Promise<Tag[]> {
  return api().tagGetAll();
}

export async function updateTag(id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag | null> {
  return api().tagUpdate(id, updates as Record<string, unknown>);
}

export async function deleteTag(id: string): Promise<void> {
  return api().tagDelete(id);
}
