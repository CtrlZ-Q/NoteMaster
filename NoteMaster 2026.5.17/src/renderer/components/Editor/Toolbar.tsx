import React from 'react';
import { Tooltip, Divider } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  LinkOutlined,
  PictureOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  MinusOutlined,
  TableOutlined,
  QuoteOutlined,
} from '@ant-design/icons';

interface ToolbarProps {
  onInsert: (syntax: string, placeholder?: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onInsert }) => {
  const tools = [
    {
      group: 'text',
      items: [
        { icon: <BoldOutlined />, label: '粗体', syntax: 'bold', shortcut: 'Ctrl+B' },
        { icon: <ItalicOutlined />, label: '斜体', syntax: 'italic', shortcut: 'Ctrl+I' },
        { icon: <StrikethroughOutlined />, label: '删除线', syntax: 'strikethrough' },
      ],
    },
    {
      group: 'heading',
      items: [
        { label: 'H1', syntax: '# ', text: 'H1' },
        { label: 'H2', syntax: '## ', text: 'H2' },
        { label: 'H3', syntax: '### ', text: 'H3' },
      ],
    },
    {
      group: 'list',
      items: [
        { icon: <UnorderedListOutlined />, label: '无序列表', syntax: '- ' },
        { icon: <OrderedListOutlined />, label: '有序列表', syntax: '1. ' },
        { label: '任务列表', syntax: '- [ ] ', text: '☑' },
      ],
    },
    {
      group: 'insert',
      items: [
        { icon: <LinkOutlined />, label: '链接', syntax: 'link' },
        { icon: <PictureOutlined />, label: '图片', syntax: 'image' },
        { icon: <CodeOutlined />, label: '代码', syntax: 'code' },
        { icon: <QuoteOutlined />, label: '引用', syntax: '> ' },
        { icon: <MinusOutlined />, label: '分隔线', syntax: '\n---\n' },
        { icon: <TableOutlined />, label: '表格', syntax: '\n| 列1 | 列2 | 列3 |\n|------|------|------|\n| 内容 | 内容 | 内容 |\n' },
      ],
    },
  ];

  return (
    <div className="editor-toolbar">
      {tools.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <Divider type="vertical" />}
          <div className="toolbar-group">
            {group.items.map((item, ii) => (
              <Tooltip
                key={ii}
                title={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`}
              >
                <button
                  className="toolbar-btn"
                  onClick={() => onInsert(item.syntax)}
                >
                  {item.icon || <span className="toolbar-text">{item.text}</span>}
                </button>
              </Tooltip>
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default Toolbar;
