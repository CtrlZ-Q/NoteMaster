/**
 * 搜索服务层
 * FlexSearch 索引在 renderer 内存，数据通过 IPC 从 main process 获取
 */

import { Document } from 'flexsearch';
import { Note, SearchResult } from '../types';

interface IndexedNote {
  id: string;
  title: string;
  content: string;
}

let searchIndex: Document<IndexedNote, true> | null = null;

function createIndex(): Document<IndexedNote, true> {
  return new Document<IndexedNote, true>({
    document: {
      id: 'id',
      index: ['title', 'content'],
      store: ['title', 'content'],
    },
    tokenize: 'forward',
    cache: true,
  });
}

export async function rebuildSearchIndex(): Promise<void> {
  searchIndex = createIndex();

  const notes = await window.electronAPI.noteGetAll({ isDeleted: false });
  for (const note of notes) {
    searchIndex.add({ id: note.id, title: note.title, content: note.content });
  }
}

export function addNoteToIndex(note: Note): void {
  if (!searchIndex) return;
  searchIndex.add({ id: note.id, title: note.title, content: note.content });
}

export function removeNoteFromIndex(noteId: string): void {
  if (!searchIndex) return;
  searchIndex.remove(noteId);
}

export function updateNoteInIndex(note: Note): void {
  if (!searchIndex) return;
  searchIndex.update({ id: note.id, title: note.title, content: note.content });
}

export function search(query: string, limit: number = 20): SearchResult[] {
  if (!searchIndex || !query.trim()) return [];

  const results = searchIndex.search(query, {
    limit,
    enrich: true,
  });

  const noteResults = new Map<string, SearchResult>();

  for (const fieldResult of results) {
    for (const item of fieldResult.result) {
      const doc = item.doc;
      if (!doc) continue;

      const existing = noteResults.get(item.id as string);
      if (existing) {
        existing.matchCount++;
      } else {
        const highlights = highlightMatches(doc.content, query);
        noteResults.set(item.id as string, {
          noteId: item.id as string,
          title: doc.title,
          content: doc.content.substring(0, 200),
          matchCount: 1,
          highlights,
        });
      }
    }
  }

  return Array.from(noteResults.values()).sort((a, b) => b.matchCount - a.matchCount);
}

function highlightMatches(text: string, query: string): string[] {
  const highlights: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  for (const word of words) {
    let index = 0;
    while (index < lowerText.length) {
      const pos = lowerText.indexOf(word, index);
      if (pos === -1) break;

      const start = Math.max(0, pos - 30);
      const end = Math.min(text.length, pos + word.length + 30);
      let snippet = text.substring(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet += '...';

      highlights.push(snippet);
      index = pos + word.length;

      if (highlights.length >= 3) break;
    }
    if (highlights.length >= 3) break;
  }

  return highlights.length > 0 ? highlights : [text.substring(0, 60) + '...'];
}

export function getSearchSuggestions(query: string): string[] {
  if (!query.trim()) return [];
  const results = search(query, 5);
  return results.map((r) => r.title);
}
