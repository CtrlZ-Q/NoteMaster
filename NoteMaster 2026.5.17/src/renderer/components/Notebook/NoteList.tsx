import React, { useState, useCallback, useMemo } from 'react';
import { Input, Button, Select, Space, Empty, Dropdown, message, Modal } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Virtuoso } from 'react-virtuoso';
import NoteItem from './NoteItem';
import { Note, SortBy, SortOrder } from '../../types';
import { createNote, deleteNote, permanentDeleteNote, restoreNote } from '../../services/noteService';
import { removeNoteFromIndex, addNoteToIndex } from '../../services/searchService';

interface NoteListProps {
  notes: Note[];
  selectedNoteId: string | null;
  isDeleted?: boolean;
  onSelectNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onRefresh: () => void;
  folderId?: string | null;
  tag?: string | null;
}

const NoteList: React.FC<NoteListProps> = ({
  notes,
  selectedNoteId,
  isDeleted = false,
  onSelectNote,
  onDeleteNote,
  onRefresh,
  folderId,
  tag,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredNotes = useMemo(() => {
    let filtered = [...notes];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    filtered.sort((a, b) => {
      let compare = 0;
      switch (sortBy) {
        case 'title':
          compare = a.title.localeCompare(b.title, 'zh-CN');
          break;
        case 'createdAt':
          compare = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'wordCount':
          compare = a.wordCount - b.wordCount;
          break;
        case 'updatedAt':
        default:
          compare = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? compare : -compare;
    });

    return filtered;
  }, [notes, searchQuery, sortBy, sortOrder]);

  const handleNewNote = useCallback(async () => {
    try {
      const note = await createNote('无标题笔记', folderId);
      addNoteToIndex(note);
      onSelectNote(note.id);
      onRefresh();
      message.success('新笔记已创建');
    } catch {
      message.error('创建笔记失败');
    }
  }, [folderId, onSelectNote, onRefresh]);

  const handleDeleteNote = useCallback(
    (noteId: string, permanent?: boolean) => {
      if (permanent) {
        Modal.confirm({
          title: '永久删除',
          icon: <ExclamationCircleOutlined />,
          content: '此操作不可恢复，确定要永久删除这篇笔记吗？',
          onOk: async () => {
            try {
              await permanentDeleteNote(noteId);
              removeNoteFromIndex(noteId);
              onDeleteNote(noteId);
              message.success('笔记已永久删除');
            } catch {
              message.error('永久删除失败');
            }
          },
        });
      } else {
        deleteNote(noteId)
          .then(() => {
            removeNoteFromIndex(noteId);
            onDeleteNote(noteId);
            message.success('笔记已移到回收站');
          })
          .catch(() => {
            message.error('删除失败');
          });
      }
    },
    [onDeleteNote],
  );

  const handleRestoreNote = useCallback(
    async (noteId: string) => {
      try {
        await restoreNote(noteId);
        onDeleteNote(noteId);
        message.success('笔记已还原');
      } catch {
        message.error('还原笔记失败');
      }
    },
    [onDeleteNote],
  );

  const getTitle = () => {
    if (isDeleted) return '回收站';
    if (tag) return `标签: ${tag}`;
    if (folderId) return '文件夹笔记';
    return '全部笔记';
  };

  return (
    <div className="note-list">
      <div className="note-list-header">
        <div className="note-list-title">{getTitle()}</div>
        <Space>
          {!isDeleted && (
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleNewNote}>
              新建
            </Button>
          )}
        </Space>
      </div>

      <div className="note-list-toolbar">
        <Input
          placeholder="搜索笔记..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size="small"
        />
        <Space size="small">
          <Select
            value={sortBy}
            onChange={setSortBy}
            size="small"
            style={{ width: 100 }}
            options={[
              { label: '更新时间', value: 'updatedAt' },
              { label: '创建时间', value: 'createdAt' },
              { label: '标题', value: 'title' },
              { label: '字数', value: 'wordCount' },
            ]}
          />
          <Button
            icon={<SortAscendingOutlined style={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />}
            size="small"
            onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          />
        </Space>
      </div>

      <div className="note-list-content">
        {filteredNotes.length === 0 ? (
          <Empty
            description={searchQuery ? '没有找到匹配的笔记' : '暂无笔记'}
            style={{ marginTop: 40 }}
          >
            {!searchQuery && (
              <Button type="primary" onClick={handleNewNote}>
                创建第一篇笔记
              </Button>
            )}
          </Empty>
        ) : (
          <Virtuoso
            data={filteredNotes}
            itemContent={(index, note) => (
              <NoteItem
                key={note.id}
                note={note}
                isSelected={note.id === selectedNoteId}
                isDeleted={isDeleted}
                onClick={() => onSelectNote(note.id)}
                onDelete={() => handleDeleteNote(note.id)}
                onPermanentDelete={() => handleDeleteNote(note.id, true)}
                onRestore={() => handleRestoreNote(note.id)}
                onFavoriteToggled={onRefresh}
                onMoved={() => onDeleteNote(note.id)}
              />
            )}
            style={{ height: '100%' }}
          />
        )}
      </div>

      <div className="note-list-footer">
        共 {filteredNotes.length} 篇笔记
        {searchQuery && ` (搜索: "${searchQuery}")`}
      </div>
    </div>
  );
};

export default NoteList;
