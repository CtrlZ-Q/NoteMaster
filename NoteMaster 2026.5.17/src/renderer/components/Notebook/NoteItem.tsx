import React, { useMemo, useState, useCallback } from 'react';
import { Dropdown, Tag, Modal, Select, message } from 'antd';
import {
  StarFilled,
  StarOutlined,
  DeleteOutlined,
  UndoOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { Note, Folder } from '../../types';
import { toggleFavorite, moveNote } from '../../services/noteService';
import { getFolders } from '../../services/folderService';

// 格式化时间（组件外定义，避免每次渲染重建）
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }
}

// 获取预览文本（组件外定义）
function getPreviewText(content: string): string {
  return content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\n/g, ' ')
    .trim()
    .substring(0, 100);
}

interface NoteItemProps {
  note: Note;
  isSelected: boolean;
  isDeleted?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onPermanentDelete: () => void;
  onRestore?: () => void;
  onFavoriteToggled?: () => void;
  onMoved?: () => void;
}

const NoteItem: React.FC<NoteItemProps> = ({
  note,
  isSelected,
  isDeleted = false,
  onClick,
  onDelete,
  onPermanentDelete,
  onRestore,
  onFavoriteToggled,
  onMoved,
}) => {
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  const showMoveModal = useCallback(async () => {
    try {
      const allFolders = await getFolders();
      setFolders(allFolders);
      setTargetFolderId(note.folderId);
      setMoveModalVisible(true);
    } catch {
      message.error('加载文件夹失败');
    }
  }, [note.folderId]);

  const handleMove = useCallback(async () => {
    try {
      await moveNote(note.id, targetFolderId);
      message.success('笔记已移动');
      setMoveModalVisible(false);
      onMoved?.();
    } catch {
      message.error('移动失败');
    }
  }, [note.id, targetFolderId, onMoved]);

  // 右键菜单
  const menuItems = useMemo(
    () => {
      if (isDeleted) {
        return [
          {
            key: 'restore',
            icon: <UndoOutlined />,
            label: '还原',
            onClick: (e: { domEvent: React.MouseEvent }) => {
              e.domEvent.stopPropagation();
              onRestore?.();
            },
          },
          { type: 'divider' as const },
          {
            key: 'permanentDelete',
            icon: <DeleteOutlined />,
            label: '永久删除',
            danger: true,
            onClick: (e: { domEvent: React.MouseEvent }) => {
              e.domEvent.stopPropagation();
              onPermanentDelete();
            },
          },
        ];
      }

      return [
        {
          key: 'favorite',
          icon: note.isFavorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />,
          label: note.isFavorite ? '取消收藏' : '收藏',
          onClick: async (e: { domEvent: React.MouseEvent }) => {
            e.domEvent.stopPropagation();
            await toggleFavorite(note.id);
            onFavoriteToggled?.();
          },
        },
        {
          key: 'move',
          icon: <FolderOutlined />,
          label: '移动到文件夹',
          onClick: (e: { domEvent: React.MouseEvent }) => {
            e.domEvent.stopPropagation();
            showMoveModal();
          },
        },
        { type: 'divider' as const },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '移到回收站',
          onClick: (e: { domEvent: React.MouseEvent }) => {
            e.domEvent.stopPropagation();
            onDelete();
          },
        },
        {
          key: 'permanentDelete',
          icon: <DeleteOutlined />,
          label: '永久删除',
          danger: true,
          onClick: (e: { domEvent: React.MouseEvent }) => {
            e.domEvent.stopPropagation();
            onPermanentDelete();
          },
        },
      ];
    },
    [isDeleted, note.isFavorite, note.id, note.folderId, onDelete, onPermanentDelete, onRestore, onFavoriteToggled, showMoveModal],
  );

  return (
    <>
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
      <div
        className={`note-item ${isSelected ? 'note-item-selected' : ''}`}
        onClick={onClick}
      >
        <div className="note-item-header">
          <span className="note-item-title">
            {note.isFavorite && (
              <StarFilled style={{ color: '#faad14', marginRight: 4, fontSize: 12 }} />
            )}
            {note.title || '无标题'}
          </span>
          <span className="note-item-time">{formatTime(note.updatedAt)}</span>
        </div>
        <div className="note-item-preview">{getPreviewText(note.content) || '暂无内容'}</div>
        <div className="note-item-footer">
          <div className="note-item-tags">
            {note.tags.slice(0, 3).map((tag) => (
              <Tag key={tag} color="blue" style={{ fontSize: 11 }}>
                {tag}
              </Tag>
            ))}
          </div>
          <span className="note-item-count">{note.wordCount}字</span>
        </div>
      </div>
    </Dropdown>
    <Modal
      title="移动到文件夹"
      open={moveModalVisible}
      onOk={handleMove}
      onCancel={() => setMoveModalVisible(false)}
      okText="移动"
      cancelText="取消"
    >
      <Select
        style={{ width: '100%' }}
        value={targetFolderId}
        onChange={setTargetFolderId}
        placeholder="选择目标文件夹（留空移到根目录）"
        allowClear
        options={folders.map((f) => ({ label: f.name, value: f.id }))}
      />
    </Modal>
    </>
  );
};

export default React.memo(NoteItem);
