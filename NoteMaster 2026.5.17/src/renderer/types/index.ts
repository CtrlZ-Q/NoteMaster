// 笔记类型
export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  isDeleted: boolean;
  wordCount: number;
}

// 文件夹类型
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  noteCount?: number;
}

// 标签类型
export interface Tag {
  id: string;
  name: string;
  color: string;
  noteCount?: number;
}

// AI摘要结果
export interface AISummary {
  summary: string;
  keywords: string[];
  keyPoints: string[];
}

// 知识图谱节点
export interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'tag' | 'folder';
  size: number;
  color: string;
  x?: number;
  y?: number;
}

// 知识图谱边
export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  weight: number;
}

// 知识图谱数据
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// 导出选项
export interface ExportOptions {
  format: 'pdf' | 'html' | 'image';
  includeStyles: boolean;
  pageSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  quality: number;
}

// 搜索结果
export interface SearchResult {
  noteId: string;
  title: string;
  content: string;
  matchCount: number;
  highlights: string[];
}

// 视图模式
export type ViewMode = 'edit' | 'preview' | 'split';

// 排序方式
export type SortBy = 'updatedAt' | 'createdAt' | 'title' | 'wordCount';
export type SortOrder = 'asc' | 'desc';

// 列表筛选
export interface NoteFilter {
  folderId?: string | null;
  tag?: string;
  searchQuery?: string;
  isFavorite?: boolean;
  isDeleted?: boolean;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}

// Electron API 类型声明
export interface ElectronAPI {
  openFile: (options?: object) => Promise<{ filePath: string; content: string } | null>;
  saveFile: (options?: object) => Promise<string | null>;
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  getUserData: () => Promise<string>;
  getVersion: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // 笔记 DB 操作
  noteGetById: (id: string) => Promise<Note | null>;
  noteGetAll: (filter: Record<string, unknown>) => Promise<Note[]>;
  noteCreate: (data: { title: string; folderId?: string | null; content?: string }) => Promise<Note>;
  noteUpdate: (id: string, updates: Record<string, unknown>) => Promise<Note | null>;
  noteDelete: (id: string) => Promise<void>;
  notePermanentDelete: (id: string) => Promise<void>;
  noteRestore: (id: string) => Promise<void>;
  noteMove: (noteId: string, folderId: string | null) => Promise<void>;
  noteToggleFavorite: (id: string) => Promise<boolean>;
  noteSetTags: (noteId: string, tagIds: string[]) => Promise<void>;

  // 文件夹 DB 操作
  folderGetAll: (parentId?: string | null) => Promise<Folder[]>;
  folderCreate: (data: { name: string; parentId?: string | null }) => Promise<Folder>;
  folderUpdate: (id: string, updates: Record<string, unknown>) => Promise<Folder | null>;
  folderDelete: (id: string) => Promise<void>;

  // 标签 DB 操作
  tagGetAll: () => Promise<Tag[]>;
  tagCreate: (data: { name: string; color?: string }) => Promise<Tag>;
  tagUpdate: (id: string, updates: Record<string, unknown>) => Promise<Tag | null>;
  tagDelete: (id: string) => Promise<void>;

  // AI 配置
  getAIConfig: () => Promise<{ endpoint: string; model: string; hasKey: boolean } | null>;
  saveAIConfig: (config: { apiKey: string; endpoint: string; model: string }) => Promise<void>;
  callAI: (params: { prompt: string; content: string }) => Promise<string>;

  // 菜单事件
  onMenuNewNote: (callback: () => void) => () => void;
  onMenuNewFolder: (callback: () => void) => () => void;
  onMenuSave: (callback: () => void) => () => void;
  onMenuExport: (callback: (format: string) => void) => () => void;
  onMenuView: (callback: (mode: string) => void) => () => void;
  onMenuSaveAll: (callback: () => void) => () => void;
  onMenuImport: (callback: () => void) => () => void;
  onMenuFind: (callback: () => void) => () => void;
  onMenuReplace: (callback: () => void) => () => void;
  onMenuGraph: (callback: () => void) => () => void;
  onMenuAiSummary: (callback: () => void) => () => void;
  onMenuAiExtract: (callback: () => void) => () => void;
  onMenuAiCheck: (callback: () => void) => () => void;
  onMenuSettings: (callback: () => void) => () => void;
  onMenuHelp: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
