import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Button, Input, Modal, message, Dropdown, Tooltip } from 'antd';
import {
  FolderOutlined,
  FolderAddOutlined,
  FileTextOutlined,
  StarOutlined,
  TagsOutlined,
  DeleteOutlined,
  PlusOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  AppstoreOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { Folder, Tag } from '../../types';
import { getFolders, createFolder, updateFolder, deleteFolder } from '../../services/folderService';
import { getAllTags } from '../../services/tagService';
import { createNote } from '../../services/noteService';
import { addNoteToIndex } from '../../services/searchService';
import './sidebar.css';

interface SidebarProps {
  selectedFolderId: string | null;
  selectedTag: string | null;
  isFavorite: boolean;
  isDeleted: boolean;
  refreshKey?: number;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTag: (tagName: string | null) => void;
  onSelectFavorite: () => void;
  onSelectTrash: () => void;
  onNewNote: () => void;
  newFolderTrigger?: number;
  onOpenTagManager?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedFolderId,
  selectedTag,
  isFavorite,
  isDeleted,
  refreshKey,
  isDark,
  onToggleTheme,
  onSelectFolder,
  onSelectTag,
  onSelectFavorite,
  onSelectTrash,
  onNewNote,
  newFolderTrigger,
  onOpenTagManager,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [fetchedFolders, fetchedTags] = await Promise.all([getFolders(), getAllTags()]);
      setFolders(fetchedFolders);
      setTags(fetchedTags);
    } catch (error) {
      console.error('加载侧边栏数据失败:', error);
      message.error('加载侧边栏数据失败');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    if (newFolderTrigger && newFolderTrigger > 0) {
      setEditingFolder(null);
      setNewFolderName('');
      setNewFolderVisible(true);
    }
  }, [newFolderTrigger]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      message.warning('请输入文件夹名称');
      return;
    }
    try {
      await createFolder(newFolderName.trim());
      message.success('文件夹创建成功');
      setNewFolderVisible(false);
      setNewFolderName('');
      loadData();
    } catch {
      message.error('创建文件夹失败');
    }
  }, [newFolderName, loadData]);

  const handleRenameFolder = useCallback(async () => {
    if (!editingFolder || !newFolderName.trim()) return;
    try {
      await updateFolder(editingFolder.id, { name: newFolderName.trim() });
      message.success('重命名成功');
      setEditingFolder(null);
      setNewFolderName('');
      setNewFolderVisible(false);
      loadData();
    } catch {
      message.error('重命名失败');
    }
  }, [editingFolder, newFolderName, loadData]);

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      Modal.confirm({
        title: '确认删除',
        icon: <ExclamationCircleOutlined />,
        content: '删除文件夹后，其中的笔记将移到根目录。确定要删除吗？',
        onOk: async () => {
          try {
            await deleteFolder(folderId);
            message.success('文件夹已删除');
            if (selectedFolderId === folderId) {
              onSelectFolder(null);
            }
            loadData();
          } catch {
            message.error('删除文件夹失败');
          }
        },
      });
    },
    [selectedFolderId, onSelectFolder, loadData],
  );

  const handleQuickNewNote = useCallback(
    async (folderId?: string) => {
      try {
        const note = await createNote('无标题笔记', folderId);
        addNoteToIndex(note);
        onNewNote();
        message.success('新笔记已创建');
      } catch {
        message.error('创建笔记失败');
      }
    },
    [onNewNote],
  );

  const getFolderMenuItems = (folder: Folder) => [
    {
      key: 'rename',
      label: '重命名',
      icon: <EditOutlined />,
      onClick: () => {
        setEditingFolder(folder);
        setNewFolderName(folder.name);
        setNewFolderVisible(true);
      },
    },
    {
      key: 'newNote',
      label: '新建笔记',
      icon: <FileTextOutlined />,
      onClick: () => handleQuickNewNote(folder.id),
    },
    { type: 'divider' as const },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleDeleteFolder(folder.id),
    },
  ];

  const menuItems = [
    {
      key: 'all',
      icon: <AppstoreOutlined />,
      label: '全部笔记',
    },
    {
      key: 'favorites',
      icon: <StarOutlined />,
      label: '收藏夹',
    },
    { type: 'divider' as const },
    {
      key: 'folders-header',
      label: (
        <div className="sidebar-header">
          <span>文件夹</span>
          <Tooltip title="新建文件夹">
            <Button
              type="text"
              size="small"
              icon={<FolderAddOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setEditingFolder(null);
                setNewFolderName('');
                setNewFolderVisible(true);
              }}
            />
          </Tooltip>
        </div>
      ),
      type: 'group' as const,
      children: folders.map((folder) => ({
        key: `folder-${folder.id}`,
        icon: <FolderOutlined style={{ color: folder.color }} />,
        label: (
          <Dropdown menu={{ items: getFolderMenuItems(folder) }} trigger={['contextMenu']}>
            <div className="folder-item">
              <span>{folder.name}</span>
              <span className="folder-count">{folder.noteCount || 0}</span>
            </div>
          </Dropdown>
        ),
      })),
    },
    { type: 'divider' as const },
    {
      key: 'tags-header',
      label: (
        <div className="sidebar-header">
          <span>标签</span>
          {onOpenTagManager && (
            <Tooltip title="管理标签">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTagManager();
                }}
              />
            </Tooltip>
          )}
        </div>
      ),
      type: 'group' as const,
      children: tags.slice(0, 20).map((tag) => ({
        key: `tag-${tag.name}`,
        icon: <TagsOutlined style={{ color: tag.color }} />,
        label: (
          <div className="tag-item">
            <span>{tag.name}</span>
            <span className="tag-count">{tag.noteCount || 0}</span>
          </div>
        ),
      })),
    },
    { type: 'divider' as const },
    {
      key: 'trash',
      icon: <DeleteOutlined />,
      label: '回收站',
    },
  ];

  const handleMenuClick = useCallback(
    ({ key }: { key: string }) => {
      if (key === 'all') {
        onSelectFolder(null);
        onSelectTag(null);
      } else if (key === 'favorites') {
        onSelectFavorite();
      } else if (key === 'trash') {
        onSelectTrash();
      } else if (key.startsWith('folder-')) {
        const folderId = key.replace('folder-', '');
        onSelectFolder(folderId);
        onSelectTag(null);
      } else if (key.startsWith('tag-')) {
        const tagName = key.replace('tag-', '');
        onSelectTag(tagName);
        onSelectFolder(null);
      }
    },
    [onSelectFolder, onSelectTag, onSelectFavorite, onSelectTrash],
  );

  const getSelectedKey = () => {
    if (isDeleted) return 'trash';
    if (isFavorite) return 'favorites';
    if (selectedTag) return `tag-${selectedTag}`;
    if (selectedFolderId) return `folder-${selectedFolderId}`;
    return 'all';
  };

  return (
    <div className="sidebar">
      <div className="sidebar-title">
        <h2>NoteMaster</h2>
        {onToggleTheme && (
          <Tooltip title={isDark ? '切换亮色模式' : '切换暗色模式'}>
            <Button
              type="text"
              size="small"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={onToggleTheme}
            />
          </Tooltip>
        )}
      </div>

      <div className="sidebar-actions">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={() => handleQuickNewNote(selectedFolderId || undefined)}
        >
          新建笔记
        </Button>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        items={menuItems}
        onClick={handleMenuClick}
        className="sidebar-menu"
      />

      <Modal
        title={editingFolder ? '重命名文件夹' : '新建文件夹'}
        open={newFolderVisible}
        onOk={editingFolder ? handleRenameFolder : handleCreateFolder}
        onCancel={() => {
          setNewFolderVisible(false);
          setEditingFolder(null);
          setNewFolderName('');
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入文件夹名称"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={editingFolder ? handleRenameFolder : handleCreateFolder}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default Sidebar;
