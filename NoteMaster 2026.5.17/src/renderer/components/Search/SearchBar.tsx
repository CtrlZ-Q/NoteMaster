import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input, List, Tag, Empty, Spin, Drawer } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { SearchResult } from '../../types';
import { search, getSearchSuggestions } from '../../services/searchService';

interface SearchBarProps {
  visible: boolean;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ visible, onClose, onSelectNote }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<{ focus: () => void } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [visible]);

  // 搜索
  const handleSearch = useCallback((searchQuery: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchQuery.trim()) {
      setResults([]);
      setSuggestions([]);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      const run = () => {
        const searchResults = search(searchQuery);
        setResults(searchResults);
        setSuggestions(getSearchSuggestions(searchQuery));
        setLoading(false);
      };
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(run, { timeout: 200 });
      } else {
        run();
      }
    }, 200);
  }, []);

  // 输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      handleSearch(value);
    },
    [handleSearch],
  );

  // 选择结果
  const handleSelectResult = useCallback(
    (noteId: string) => {
      onSelectNote(noteId);
      onClose();
      setQuery('');
      setResults([]);
    },
    [onSelectNote, onClose],
  );

  // 高亮匹配文本
  const highlightText = (text: string, maxLen: number = 80) => {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  };

  return (
    <Drawer
      title="搜索笔记"
      placement="top"
      onClose={onClose}
      open={visible}
      height={500}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ padding: '16px' }}>
        <Input
          ref={inputRef}
          size="large"
          placeholder="输入关键词搜索笔记标题、内容、标签..."
          prefix={<SearchOutlined />}
          value={query}
          onChange={handleInputChange}
          allowClear
        />
      </div>

      <div style={{ padding: '0 16px 16px', maxHeight: 380, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="搜索中..." />
          </div>
        ) : results.length === 0 && query ? (
          <Empty description="没有找到匹配的笔记" />
        ) : (
          <List
            dataSource={results}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '12px 8px' }}
                onClick={() => handleSelectResult(item.noteId)}
              >
                <List.Item.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 18, color: '#1890ff' }} />}
                  title={
                    <span>
                      {item.title}
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        匹配 {item.matchCount} 次
                      </Tag>
                    </span>
                  }
                  description={
                    <div>
                      {item.highlights.slice(0, 2).map((h, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                          {highlightText(h)}
                        </div>
                      ))}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </Drawer>
  );
};

export default SearchBar;
