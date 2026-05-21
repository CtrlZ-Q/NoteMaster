import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Input, Tag, Space, Button, ColorPicker, message, Empty, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Tag as TagType } from '../../types';
import { getAllTags, createTag, updateTag, deleteTag } from '../../services/tagService';

interface TagManagerProps {
  visible: boolean;
  onClose: () => void;
  onTagsChange: () => void;
}

const TAG_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#2f54eb', '#a0d911',
];

const TagManager: React.FC<TagManagerProps> = ({ visible, onClose, onTagsChange }) => {
  const [tags, setTags] = useState<TagType[]>([]);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#1890ff');
  const [isEditing, setIsEditing] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      setTags(await getAllTags());
    } catch (error) {
      console.error('加载标签失败:', error);
      message.error('加载标签失败');
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadTags();
    }
  }, [visible, loadTags]);

  const handleCreate = useCallback(async () => {
    if (!newTagName.trim()) {
      message.warning('请输入标签名称');
      return;
    }

    const existing = tags.find((t) => t.name === newTagName.trim());
    if (existing) {
      message.warning('标签已存在');
      return;
    }

    try {
      await createTag(newTagName.trim(), newTagColor);
      message.success('标签创建成功');
      setNewTagName('');
      loadTags();
      onTagsChange();
    } catch {
      message.error('创建标签失败');
    }
  }, [newTagName, newTagColor, tags, loadTags, onTagsChange]);

  const handleUpdate = useCallback(async () => {
    if (!editingTag || !newTagName.trim()) return;

    const existing = tags.find((t) => t.name === newTagName.trim() && t.id !== editingTag.id);
    if (existing) {
      message.warning('标签名已存在');
      return;
    }

    try {
      await updateTag(editingTag.id, { name: newTagName.trim(), color: newTagColor });
      message.success('标签更新成功');
      setEditingTag(null);
      setIsEditing(false);
      setNewTagName('');
      loadTags();
      onTagsChange();
    } catch {
      message.error('更新标签失败');
    }
  }, [editingTag, newTagName, newTagColor, tags, loadTags, onTagsChange]);

  const handleDelete = useCallback(
    async (tagId: string) => {
      try {
        await deleteTag(tagId);
        message.success('标签已删除');
        loadTags();
        onTagsChange();
      } catch {
        message.error('删除标签失败');
      }
    },
    [loadTags, onTagsChange],
  );

  const startEdit = useCallback((tag: TagType) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setIsEditing(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingTag(null);
    setNewTagName('');
    setNewTagColor('#1890ff');
    setIsEditing(false);
  }, []);

  return (
    <Modal
      title="标签管理"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="标签名称"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={isEditing ? handleUpdate : handleCreate}
          />
          <ColorPicker
            value={newTagColor}
            onChange={(_, hex) => setNewTagColor(hex)}
            presets={[
              {
                label: '推荐',
                colors: TAG_COLORS,
              },
            ]}
          />
          {isEditing ? (
            <Space>
              <Button type="primary" onClick={handleUpdate}>
                保存
              </Button>
              <Button onClick={cancelEdit}>取消</Button>
            </Space>
          ) : (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建
            </Button>
          )}
        </Space>
      </div>

      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {tags.length === 0 ? (
          <Empty description="暂无标签" />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((tag) => (
              <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag
                  color={tag.color}
                  style={{ cursor: 'pointer', margin: 0 }}
                  onClick={() => startEdit(tag)}
                >
                  {tag.name}
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>({tag.noteCount || 0})</span>
                </Tag>
                <Popconfirm
                  title="确定要删除这个标签吗？"
                  onConfirm={() => handleDelete(tag.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    danger
                  />
                </Popconfirm>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TagManager;
