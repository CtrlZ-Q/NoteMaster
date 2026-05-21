/**
 * 笔记服务层 — 通过 IPC 调用 main process DB
 */

import { Note, NoteFilter } from '../types';

const api = () => window.electronAPI;

export async function createNote(title: string, folderId?: string | null, content?: string): Promise<Note> {
  return api().noteCreate({ title, folderId: folderId ?? null, content });
}

export async function getNoteById(id: string): Promise<Note | null> {
  return api().noteGetById(id);
}

export async function getNotes(filter: NoteFilter = {}): Promise<Note[]> {
  return api().noteGetAll(filter as Record<string, unknown>);
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'isFavorite'>>,
): Promise<Note | null> {
  return api().noteUpdate(id, updates as Record<string, unknown>);
}

export async function deleteNote(id: string): Promise<void> {
  return api().noteDelete(id);
}

export async function permanentDeleteNote(id: string): Promise<void> {
  return api().notePermanentDelete(id);
}

export async function restoreNote(id: string): Promise<void> {
  return api().noteRestore(id);
}

export async function moveNote(noteId: string, folderId: string | null): Promise<void> {
  return api().noteMove(noteId, folderId);
}

export async function toggleFavorite(id: string): Promise<boolean> {
  return api().noteToggleFavorite(id);
}

export async function setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
  return api().noteSetTags(noteId, tagIds);
}

