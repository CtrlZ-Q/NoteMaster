/**
 * 数据库 IPC 处理器
 * 所有 DB 操作在 main process 执行，renderer 通过 IPC 调用
 */

import { randomUUID } from 'crypto';
import { getDatabase } from './db';
import Database from 'better-sqlite3';
import { createChannelRegistry } from './ipcUtils';

const { safeHandle, removeAll: removeHandledChannels } = createChannelRegistry();

// --- 工具函数 ---

function queryAll(sql: string, ...params: unknown[]): unknown[] {
  return getDatabase().prepare(sql).all(...params);
}

function queryOne(sql: string, ...params: unknown[]): unknown {
  return getDatabase().prepare(sql).get(...params);
}

function execute(sql: string, ...params: unknown[]): Database.RunResult {
  return getDatabase().prepare(sql).run(...params);
}

function transaction<T>(fn: () => T): T {
  return getDatabase().transaction(fn)();
}

// 输入校验
const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_LENGTH = 5_000_000;
const MAX_NAME_LENGTH = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${name} 必须是字符串`);
  if (value.length > maxLength) throw new Error(`${name} 超过最大长度 ${maxLength}`);
  return value;
}

function validateOptionalString(value: unknown, name: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  return validateString(value, name, maxLength);
}

function validateId(value: unknown, name = 'id'): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new Error(`${name} 格式无效`);
  return value;
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}

function isDescendant(folderId: string, potentialAncestorId: string): boolean {
  const row = queryOne(
    `WITH RECURSIVE ancestors(id) AS (
       SELECT parent_id FROM folders WHERE id = ?
       UNION ALL
       SELECT f.parent_id FROM folders f INNER JOIN ancestors a ON f.id = a.id WHERE a.id IS NOT NULL
     ) SELECT 1 FROM ancestors WHERE id = ? LIMIT 1`,
    folderId, potentialAncestorId,
  ) as Record<string, unknown> | undefined;
  return !!row;
}

// --- 笔记操作 ---

function mapRowToNote(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    folderId: row.folder_id,
    tags: row.tag_names ? (row.tag_names as string).split(',') : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isFavorite: Boolean(row.is_favorite),
    isDeleted: Boolean(row.is_deleted),
    wordCount: row.word_count,
  };
}

function registerNoteHandlers(): void {
  safeHandle('db:note:getById', (_, id: string) => {
    validateId(id);
    const row = queryOne(
      `SELECT n.*, GROUP_CONCAT(t.name) as tag_names
       FROM notes n
       LEFT JOIN note_tags nt ON n.id = nt.note_id
       LEFT JOIN tags t ON nt.tag_id = t.id
       WHERE n.id = ?
       GROUP BY n.id`,
      id,
    ) as Record<string, unknown> | undefined;
    return row ? mapRowToNote(row) : null;
  });

  safeHandle('db:note:getAll', (_, filter: Record<string, unknown>) => {
    const f = filter ?? {};
    const {
      folderId,
      tag,
      searchQuery,
      isFavorite,
      isDeleted = false,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = f;

    let sql = `
      SELECT n.*, GROUP_CONCAT(t.name) as tag_names
      FROM notes n
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.is_deleted = ?
    `;
    const params: unknown[] = [isDeleted ? 1 : 0];

    if (folderId !== undefined) {
      if (folderId === null) {
        sql += ' AND n.folder_id IS NULL';
      } else {
        sql += ' AND n.folder_id = ?';
        params.push(folderId);
      }
    }

    if (isFavorite !== undefined) {
      sql += ' AND n.is_favorite = ?';
      params.push(isFavorite ? 1 : 0);
    }

    if (tag) {
      sql += ' AND n.id IN (SELECT nt2.note_id FROM note_tags nt2 INNER JOIN tags t2 ON nt2.tag_id = t2.id WHERE t2.name = ?)';
      params.push(tag);
    }

    if (searchQuery) {
      validateString(searchQuery, 'searchQuery', 500);
      sql += " AND (n.title LIKE ? ESCAPE '\\' OR n.content LIKE ? ESCAPE '\\')";
      const query = `%${escapeLike(searchQuery as string)}%`;
      params.push(query, query);
    }

    sql += ' GROUP BY n.id';

    const ALLOWED_SORT: Record<string, string> = {
      updatedAt: 'n.updated_at',
      createdAt: 'n.created_at',
      title: 'n.title',
      wordCount: 'n.word_count',
    };
    const sortColumn = ALLOWED_SORT[sortBy as string] || 'n.updated_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortColumn} ${order}`;

    return (queryAll(sql, ...params) as Record<string, unknown>[]).map(mapRowToNote);
  });

  safeHandle('db:note:create', (_, data: { title: string; folderId?: string | null; content?: string }) => {
    const title = validateString(data.title, '标题', MAX_TITLE_LENGTH);
    const content = data.content ? validateString(data.content, '内容', MAX_CONTENT_LENGTH) : '';
    const folderId = data.folderId ? validateId(data.folderId, 'folderId') : null;
    const id = randomUUID();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO notes (id, title, content, folder_id, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      title,
      content,
      folderId,
      content.length,
      now,
      now,
    );

    const row = queryOne(
      `SELECT n.*, GROUP_CONCAT(t.name) as tag_names
       FROM notes n
       LEFT JOIN note_tags nt ON n.id = nt.note_id
       LEFT JOIN tags t ON nt.tag_id = t.id
       WHERE n.id = ?
       GROUP BY n.id`,
      id,
    ) as Record<string, unknown> | undefined;
    return row ? mapRowToNote(row) : null;
  });

  safeHandle('db:note:update', (_, data: { id: string; updates: Record<string, unknown> }) => {
    const id = validateId(data.id);
    const { updates } = data;
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(validateString(updates.title, '标题', MAX_TITLE_LENGTH));
    }
    if (updates.content !== undefined) {
      const content = validateString(updates.content, '内容', MAX_CONTENT_LENGTH);
      fields.push('content = ?');
      params.push(content);
      fields.push('word_count = ?');
      params.push(content.length);
    }
    if (updates.folderId !== undefined) {
      fields.push('folder_id = ?');
      params.push(updates.folderId === null ? null : validateId(updates.folderId, 'folderId'));
    }
    if (updates.isFavorite !== undefined) {
      fields.push('is_favorite = ?');
      params.push(updates.isFavorite ? 1 : 0);
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    execute(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, ...params);

    const row = queryOne(
      `SELECT n.*, GROUP_CONCAT(t.name) as tag_names
       FROM notes n LEFT JOIN note_tags nt ON n.id = nt.note_id
       LEFT JOIN tags t ON nt.tag_id = t.id WHERE n.id = ? GROUP BY n.id`,
      id,
    ) as Record<string, unknown> | undefined;
    return row ? mapRowToNote(row) : null;
  });

  safeHandle('db:note:delete', (_, id: string) => {
    validateId(id);
    execute('UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?', new Date().toISOString(), id);
  });

  safeHandle('db:note:permanentDelete', (_, id: string) => {
    validateId(id);
    transaction(() => {
      execute('DELETE FROM note_tags WHERE note_id = ?', id);
      execute('DELETE FROM notes WHERE id = ?', id);
    });
  });

  safeHandle('db:note:restore', (_, id: string) => {
    validateId(id);
    execute('UPDATE notes SET is_deleted = 0, updated_at = ? WHERE id = ?', new Date().toISOString(), id);
  });

  safeHandle('db:note:move', (_, data: { noteId: string; folderId: string | null }) => {
    validateId(data.noteId);
    const folderId = data.folderId === null ? null : validateId(data.folderId, 'folderId');
    execute('UPDATE notes SET folder_id = ?, updated_at = ? WHERE id = ?', folderId, new Date().toISOString(), data.noteId);
  });

  safeHandle('db:note:toggleFavorite', (_, id: string) => {
    validateId(id);
    const result = execute(
      'UPDATE notes SET is_favorite = NOT is_favorite, updated_at = ? WHERE id = ?',
      new Date().toISOString(),
      id,
    );
    if (result.changes === 0) return false;
    const row = queryOne('SELECT is_favorite FROM notes WHERE id = ?', id) as Record<string, unknown> | undefined;
    return Boolean(row?.is_favorite);
  });

  safeHandle('db:note:setTags', (_, data: { noteId: string; tagIds: string[] }) => {
    validateId(data.noteId);
    if (!Array.isArray(data.tagIds)) throw new Error('tagIds 必须是数组');
    if (data.tagIds.length > 100) throw new Error('标签数量不能超过100个');
    for (const tagId of data.tagIds) {
      validateId(tagId, 'tagId');
    }
    transaction(() => {
      execute('DELETE FROM note_tags WHERE note_id = ?', data.noteId);
      for (const tagId of data.tagIds) {
        const exists = queryOne('SELECT 1 FROM tags WHERE id = ?', tagId);
        if (!exists) throw new Error(`标签 ${tagId} 不存在`);
        execute('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)', data.noteId, tagId);
      }
    });
  });

}

// --- 文件夹操作 ---

function mapRowToFolder(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    icon: (row.icon as string) || 'folder',
    color: (row.color as string) || '#1890ff',
    sortOrder: (row.sort_order as number) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    noteCount: (row.note_count as number) || 0,
  };
}

function registerFolderHandlers(): void {
  safeHandle('db:folder:getAll', (_, parentId?: string | null) => {
    let sql: string;
    const params: unknown[] = [];
    const base = `SELECT f.*,
      (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_deleted = 0) as note_count
      FROM folders f`;

    if (parentId === undefined) {
      sql = `${base} ORDER BY f.sort_order, f.name`;
    } else if (parentId === null) {
      sql = `${base} WHERE f.parent_id IS NULL ORDER BY f.sort_order, f.name`;
    } else {
      validateId(parentId, 'parentId');
      sql = `${base} WHERE f.parent_id = ? ORDER BY f.sort_order, f.name`;
      params.push(parentId);
    }

    return (queryAll(sql, ...params) as Record<string, unknown>[]).map(mapRowToFolder);
  });

  safeHandle('db:folder:create', (_, data: { name: string; parentId?: string | null }) => {
    const name = validateString(data.name, '文件夹名称', MAX_NAME_LENGTH);
    const parentId = data.parentId ? validateId(data.parentId, 'parentId') : null;
    const id = randomUUID();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      id,
      name,
      parentId,
      now,
      now,
    );

    const row = queryOne(
      `SELECT f.*, (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_deleted = 0) as note_count
       FROM folders f WHERE f.id = ?`,
      id,
    ) as Record<string, unknown> | undefined;
    return row ? mapRowToFolder(row) : null;
  });

  safeHandle('db:folder:update', (_, data: { id: string; updates: Record<string, unknown> }) => {
    const id = validateId(data.id);
    const { updates } = data;
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); params.push(validateString(updates.name, '文件夹名称', MAX_NAME_LENGTH)); }
    if (updates.parentId !== undefined) {
      const parentId = updates.parentId === null ? null : validateId(updates.parentId, 'parentId');
      if (parentId === id) throw new Error('文件夹不能作为自己的子文件夹');
      if (parentId && isDescendant(parentId, id)) throw new Error('不能将文件夹移动到其子文件夹下');
      fields.push('parent_id = ?');
      params.push(parentId);
    }
    if (updates.icon !== undefined) { fields.push('icon = ?'); params.push(validateOptionalString(updates.icon, 'icon', 50)); }
    if (updates.color !== undefined) { fields.push('color = ?'); params.push(validateOptionalString(updates.color, 'color', 20)); }
    if (updates.sortOrder !== undefined) {
      if (typeof updates.sortOrder !== 'number') throw new Error('sortOrder 必须是数字');
      fields.push('sort_order = ?');
      params.push(updates.sortOrder);
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    execute(`UPDATE folders SET ${fields.join(', ')} WHERE id = ?`, ...params);

    const row = queryOne(
      `SELECT f.*, (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_deleted = 0) as note_count
       FROM folders f WHERE f.id = ?`,
      id,
    ) as Record<string, unknown> | undefined;
    return row ? mapRowToFolder(row) : null;
  });

  safeHandle('db:folder:delete', (_, id: string) => {
    validateId(id);
    transaction(() => {
      execute('UPDATE notes SET folder_id = NULL, updated_at = ? WHERE folder_id = ?', new Date().toISOString(), id);
      execute('UPDATE folders SET parent_id = NULL WHERE parent_id = ?', id);
      execute('DELETE FROM folders WHERE id = ?', id);
    });
  });
}

// --- 标签操作 ---

function mapRowToTag(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    color: (row.color as string) || '#1890ff',
    noteCount: (row.note_count as number) || 0,
  };
}

function registerTagHandlers(): void {
  safeHandle('db:tag:getAll', () => {
    return (
      queryAll(
        `SELECT t.*,
          (SELECT COUNT(*) FROM note_tags nt INNER JOIN notes n ON nt.note_id = n.id WHERE nt.tag_id = t.id AND n.is_deleted = 0) as note_count
         FROM tags t ORDER BY note_count DESC, t.name`,
      ) as Record<string, unknown>[]
    ).map(mapRowToTag);
  });

  safeHandle('db:tag:create', (_, data: { name: string; color?: string }) => {
    const name = validateString(data.name, '标签名', MAX_NAME_LENGTH);
    const color = data.color ? validateOptionalString(data.color, 'color', 20) : '#1890ff';
    const id = randomUUID();
    execute('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', id, name, color);

    const row = queryOne(
      `SELECT t.*, (SELECT COUNT(*) FROM note_tags nt INNER JOIN notes n ON nt.note_id = n.id WHERE nt.tag_id = t.id AND n.is_deleted = 0) as note_count
       FROM tags t WHERE t.id = ?`,
      id,
    ) as Record<string, unknown> | undefined;
    return row ? mapRowToTag(row) : null;
  });

  safeHandle('db:tag:update', (_, data: { id: string; updates: Record<string, unknown> }) => {
    const id = validateId(data.id);
    const { updates } = data;
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); params.push(validateString(updates.name, '标签名', MAX_NAME_LENGTH)); }
    if (updates.color !== undefined) { fields.push('color = ?'); params.push(validateOptionalString(updates.color, 'color', 20)); }

    if (fields.length === 0) {
      const row = queryOne(
        `SELECT t.*, (SELECT COUNT(*) FROM note_tags nt INNER JOIN notes n ON nt.note_id = n.id WHERE nt.tag_id = t.id AND n.is_deleted = 0) as note_count
         FROM tags t WHERE t.id = ?`,
        id,
      ) as Record<string, unknown> | undefined;
      return row ? mapRowToTag(row) : null;
    }

    params.push(id);
    execute(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, ...params);

    const row = queryOne(
      `SELECT t.*, (SELECT COUNT(*) FROM note_tags nt INNER JOIN notes n ON nt.note_id = n.id WHERE nt.tag_id = t.id AND n.is_deleted = 0) as note_count
       FROM tags t WHERE t.id = ?`,
      id,
    ) as Record<string, unknown> | undefined;
    return row ? mapRowToTag(row) : null;
  });

  safeHandle('db:tag:delete', (_, id: string) => {
    validateId(id);
    transaction(() => {
      execute('DELETE FROM note_tags WHERE tag_id = ?', id);
      execute('DELETE FROM tags WHERE id = ?', id);
    });
  });

}

// --- 注册所有处理器 ---

export function registerDbHandlers(): void {
  registerNoteHandlers();
  registerFolderHandlers();
  registerTagHandlers();
}

export function removeDbHandlers(): void {
  removeHandledChannels();
}
