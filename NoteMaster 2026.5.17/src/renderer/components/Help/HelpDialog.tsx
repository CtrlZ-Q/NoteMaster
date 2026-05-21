import React from 'react';
import { Modal, Table, Typography } from 'antd';

interface HelpDialogProps {
  visible: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: 'Ctrl+N', action: '新建笔记' },
  { key: 'Ctrl+S', action: '保存笔记' },
  { key: 'Ctrl+Shift+S', action: '全部保存' },
  { key: 'Ctrl+F', action: '搜索笔记' },
  { key: 'Ctrl+H', action: '替换' },
  { key: 'Ctrl+B', action: '粗体' },
  { key: 'Ctrl+I', action: '斜体' },
  { key: 'Ctrl+1', action: '编辑模式' },
  { key: 'Ctrl+2', action: '预览模式' },
  { key: 'Ctrl+3', action: '分屏模式' },
  { key: 'Ctrl+G', action: '知识图谱' },
  { key: 'Ctrl+,', action: '设置' },
];

const HelpDialog: React.FC<HelpDialogProps> = ({ visible, onClose }) => {
  return (
    <Modal title="使用帮助" open={visible} onCancel={onClose} footer={null} width={600}>
      <Typography.Title level={5}>快捷键</Typography.Title>
      <Table
        dataSource={shortcuts}
        columns={[
          { title: '快捷键', dataIndex: 'key', key: 'key', width: 150 },
          { title: '功能', dataIndex: 'action', key: 'action' },
        ]}
        pagination={false}
        size="small"
        rowKey="key"
      />
      <Typography.Title level={5} style={{ marginTop: 16 }}>
        Markdown 语法
      </Typography.Title>
      <Typography.Paragraph>
        <code># 标题</code> — 一级标题<br />
        <code>## 标题</code> — 二级标题<br />
        <code>**粗体**</code> — 粗体文本<br />
        <code>*斜体*</code> — 斜体文本<br />
        <code>`代码`</code> — 行内代码<br />
        <code>```代码块```</code> — 代码块<br />
        <code>- 列表</code> — 无序列表<br />
        <code>1. 列表</code> — 有序列表<br />
        <code>- [ ] 任务</code> — 任务列表<br />
        <code>[链接](url)</code> — 超链接<br />
        <code>![图片](url)</code> — 图片<br />
        <code>$公式$</code> — 行内公式<br />
        <code>$$公式$$</code> — 块级公式<br />
        <code>&gt; 引用</code> — 引用块<br />
      </Typography.Paragraph>
      <Typography.Title level={5} style={{ marginTop: 16 }}>
        AI 功能
      </Typography.Title>
      <Typography.Paragraph>
        在 设置 → AI配置 中填入 API 端点和密钥后，可使用：<br />
        <strong>AI摘要</strong> — 自动生成笔记摘要、关键词和知识点<br />
        <strong>知识点提取</strong> — 从笔记中提取核心知识点<br />
        <strong>语法检查</strong> — 检查标题层级、链接、代码块等问题<br />
      </Typography.Paragraph>
    </Modal>
  );
};

export default HelpDialog;
