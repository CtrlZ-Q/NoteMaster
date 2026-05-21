import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Radio, Switch, Select, message, Space } from 'antd';
import { ExportOptions } from '../../types';
import { exportNote } from '../../services/exportService';
import { getNoteById } from '../../services/noteService';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({ html: false, linkify: true });

interface ExportDialogProps {
  visible: boolean;
  noteId: string | null;
  defaultFormat?: 'pdf' | 'html' | 'image';
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ visible, noteId, defaultFormat, onClose }) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: defaultFormat || 'html',
    includeStyles: true,
    pageSize: 'a4',
    orientation: 'portrait',
    quality: 90,
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (visible && defaultFormat) {
      setOptions((prev) => ({ ...prev, format: defaultFormat }));
    }
  }, [visible, defaultFormat]);

  const handleExport = useCallback(async () => {
    if (!noteId) return;

    setExporting(true);
    try {
      const note = await getNoteById(noteId);
      if (!note) {
        message.error('笔记不存在');
        return;
      }

      const renderedHtml = DOMPurify.sanitize(md.render(note.content || ''), {
        USE_PROFILES: { mathMl: true },
        ADD_TAGS: ['input'],
        ADD_ATTR: ['xmlns', 'encoding', 'type', 'checked', 'disabled'],
      });
      await exportNote(note, renderedHtml, options);
      message.success('导出成功');
      onClose();
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }, [noteId, options, onClose]);

  return (
    <Modal
      title="导出笔记"
      open={visible}
      onOk={handleExport}
      onCancel={onClose}
      okText="导出"
      cancelText="取消"
      confirmLoading={exporting}
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 导出格式 */}
        <div>
          <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>导出格式</label>
          <Radio.Group
            value={options.format}
            onChange={(e) => setOptions({ ...options, format: e.target.value })}
          >
            <Radio.Button value="html">HTML</Radio.Button>
            <Radio.Button value="pdf">PDF</Radio.Button>
            <Radio.Button value="image">图片</Radio.Button>
          </Radio.Group>
        </div>

        {/* PDF选项 */}
        {options.format === 'pdf' && (
          <>
            <div>
              <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>页面大小</label>
              <Select
                value={options.pageSize}
                onChange={(pageSize) => setOptions({ ...options, pageSize })}
                style={{ width: 120 }}
                options={[
                  { label: 'A4', value: 'a4' },
                  { label: 'Letter', value: 'letter' },
                ]}
              />
            </div>
            <div>
              <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>方向</label>
              <Radio.Group
                value={options.orientation}
                onChange={(e) => setOptions({ ...options, orientation: e.target.value })}
              >
                <Radio.Button value="portrait">纵向</Radio.Button>
                <Radio.Button value="landscape">横向</Radio.Button>
              </Radio.Group>
            </div>
          </>
        )}

        {/* 图片选项 */}
        {options.format === 'image' && (
          <div>
            <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>
              图片质量: {options.quality}%
            </label>
            <input
              type="range"
              min="50"
              max="100"
              value={options.quality}
              onChange={(e) => setOptions({ ...options, quality: Number(e.target.value) })}
              style={{ width: '100%' }}
              aria-label="图片质量"
            />
            <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>仅影响PNG图片导出质量</div>
          </div>
        )}

        {/* 通用选项 */}
        <div>
          <Space>
            <span>包含样式</span>
            <Switch
              checked={options.includeStyles}
              onChange={(includeStyles) => setOptions({ ...options, includeStyles })}
            />
          </Space>
        </div>

        {/* 提示 */}
        <div style={{ color: '#999', fontSize: 12 }}>
          {options.format === 'html' && '导出为HTML文件，可在浏览器中打开查看'}
          {options.format === 'pdf' && '导出为PDF文件，适合打印和分享'}
          {options.format === 'image' && '导出为PNG图片，适合在社交媒体分享'}
        </div>
      </div>
    </Modal>
  );
};

export default ExportDialog;
