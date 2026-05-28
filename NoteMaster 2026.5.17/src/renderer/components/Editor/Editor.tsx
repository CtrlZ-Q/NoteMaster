import React, { useState, useEffect, useCallback, useRef } from 'react';
import { message, Spin, Button, Space, Tooltip, Select } from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  ColumnWidthOutlined,
  SaveOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import Preview from './Preview';
import Toolbar from './Toolbar';
import { getNoteById, updateNote, setNoteTags } from '../../services/noteService';
import { updateNoteInIndex } from '../../services/searchService';
import { generateSummary, extractKnowledge, checkGrammar } from '../../services/aiService';
import { getAllTags } from '../../services/tagService';
import { Note, ViewMode, AISummary, Tag } from '../../types';
import './editor.css';

interface EditorProps {
  noteId: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  saveTrigger?: number;
  aiSummaryTrigger?: number;
  aiExtractTrigger?: number;
  grammarCheckTrigger?: number;
}

const Editor: React.FC<EditorProps> = ({ noteId, viewMode, onViewModeChange, onSave, saveTrigger, aiSummaryTrigger, aiExtractTrigger, grammarCheckTrigger }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [grammarIssues, setGrammarIssues] = useState<string[]>([]);
  const [extractedPoints, setExtractedPoints] = useState<string[]>([]);
  const [showExtractPanel, setShowExtractPanel] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [noteTagIds, setNoteTagIds] = useState<string[]>([]);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSaveRef = useRef<() => void>(() => {});
  const isDirtyRef = useRef(false);
  const savingRef = useRef(false);

  // 缓存最新值供 unmount 时使用
  const noteRef = useRef(note);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  useEffect(() => { noteRef.current = note; }, [note]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { contentRef.current = content; }, [content]);

  useEffect(() => {
    let cancelled = false;
    const loadNote = async () => {
      try {
        // 切笔记前先保存当前未保存内容
        if (isDirtyRef.current && noteRef.current && !savingRef.current) {
          try {
            await updateNote(noteRef.current.id, { title: titleRef.current, content: contentRef.current });
          } catch (err) {
            console.error('切换笔记前保存失败:', err);
            message.error('当前笔记保存失败，请手动重试');
          }
        }

        const loadedNote = await getNoteById(noteId);
        if (cancelled) return;
        if (loadedNote) {
          isDirtyRef.current = false;
          setNote(loadedNote);
          setContent(loadedNote.content);
          setTitle(loadedNote.title);
          setAiSummary(null);
          setGrammarIssues([]);
          setExtractedPoints([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('加载笔记失败:', error);
          message.error('加载笔记失败');
        }
      }
    };
    loadNote();
    return () => { cancelled = true; };
  }, [noteId]);

  useEffect(() => {
    getAllTags().then(setAvailableTags).catch(console.error);
  }, []);

  useEffect(() => {
    if (!note || availableTags.length === 0) return;
    const tagIds = availableTags
      .filter((t) => note.tags.includes(t.name))
      .map((t) => t.id);
    setNoteTagIds(tagIds);
  }, [noteId, note, availableTags]);

  useEffect(() => {
    if (!note) return;
    if (!isDirtyRef.current) return;

    const autoSaveEnabled = localStorage.getItem('nm-auto-save') !== 'false';
    if (!autoSaveEnabled) return;

    const interval = (Number(localStorage.getItem('nm-auto-save-interval')) || 3) * 1000;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveRef.current();
    }, interval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, title, note]);

  // unmount 时如果有未保存内容，立即保存
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (isDirtyRef.current && noteRef.current && !savingRef.current) {
        updateNote(noteRef.current.id, { title: titleRef.current, content: contentRef.current }).catch((err) => {
          console.error('卸载前保存失败:', err);
        });
      }
    };
  }, []);

  // 外部触发保存（菜单 Ctrl+S）
  useEffect(() => {
    if (saveTrigger !== undefined && saveTrigger > 0) {
      handleSaveRef.current();
    }
  }, [saveTrigger]);

  const handleSave = useCallback(async () => {
    if (!note || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await updateNote(note.id, { title, content });
      if (updated) {
        setNote(updated);
        updateNoteInIndex(updated);
        isDirtyRef.current = false;
        onSave();
      }
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [note, title, content, onSave]);

  handleSaveRef.current = handleSave;

  const handleTagChange = useCallback(async (tagIds: string[]) => {
    if (!note) return;
    try {
      await setNoteTags(note.id, tagIds);
      setNoteTagIds(tagIds);
      const tagNames = availableTags.filter((t) => tagIds.includes(t.id)).map((t) => t.name);
      setNote((prev) => (prev ? { ...prev, tags: tagNames } : prev));
      onSave();
    } catch {
      message.error('更新标签失败');
    }
  }, [note, availableTags, onSave]);

  const handleInsert = useCallback(
    (syntax: string, placeholder?: string) => {
      if (!editorRef.current) return;

      const textarea = editorRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      let newText: string;
      let cursorPos: number;

      if (syntax === 'bold' || syntax === 'italic' || syntax === 'strikethrough') {
        const markers: Record<string, string> = {
          bold: '**',
          italic: '*',
          strikethrough: '~~',
        };
        const marker = markers[syntax];
        newText = `${content.substring(0, start)}${marker}${selectedText || placeholder || syntax}${marker}${content.substring(end)}`;
        cursorPos = start + marker.length + (selectedText || placeholder || syntax).length + marker.length;
      } else if (syntax === 'code') {
        if (selectedText.includes('\n')) {
          newText = `${content.substring(0, start)}\n\`\`\`\n${selectedText || placeholder || 'code'}\n\`\`\`\n${content.substring(end)}`;
        } else {
          newText = `${content.substring(0, start)}\`${selectedText || placeholder || 'code'}\`${content.substring(end)}`;
        }
        cursorPos = start + (selectedText || placeholder || 'code').length + 2;
      } else if (syntax === 'link') {
        newText = `${content.substring(0, start)}[${selectedText || '链接文本'}](url)${content.substring(end)}`;
        cursorPos = start + (selectedText || '链接文本').length + 3;
      } else if (syntax === 'image') {
        newText = `${content.substring(0, start)}![${selectedText || '图片描述'}](url)${content.substring(end)}`;
        cursorPos = start + (selectedText || '图片描述').length + 4;
      } else {
        newText = `${content.substring(0, start)}${syntax}${selectedText || placeholder || ''}${content.substring(end)}`;
        cursorPos = start + syntax.length + (selectedText || placeholder || '').length;
      }

      isDirtyRef.current = true;
      setContent(newText);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    },
    [content],
  );

  const handleInsertRef = useRef(handleInsert);
  handleInsertRef.current = handleInsert;

  const handleAiSummary = useCallback(async () => {
    if (!content.trim()) {
      message.warning('笔记内容为空');
      return;
    }
    setShowAiPanel(true);
    try {
      const summary = await generateSummary(content);
      setAiSummary(summary);
    } catch (error) {
      message.error('AI摘要生成失败');
    }
  }, [content]);

  const handleAiSummaryRef = useRef(handleAiSummary);
  handleAiSummaryRef.current = handleAiSummary;

  // 外部触发 AI 摘要（菜单）— 用 ref 避免 content 变化时重复触发
  useEffect(() => {
    if (aiSummaryTrigger !== undefined && aiSummaryTrigger > 0) {
      handleAiSummaryRef.current();
    }
  }, [aiSummaryTrigger]);

  const handleAiExtract = useCallback(async () => {
    if (!content.trim()) {
      message.warning('笔记内容为空');
      return;
    }
    setShowExtractPanel(true);
    try {
      const points = await extractKnowledge(content);
      setExtractedPoints(points);
    } catch (error) {
      message.error('知识点提取失败');
    }
  }, [content]);

  const handleAiExtractRef = useRef(handleAiExtract);
  handleAiExtractRef.current = handleAiExtract;

  // 外部触发知识点提取（菜单）
  useEffect(() => {
    if (aiExtractTrigger !== undefined && aiExtractTrigger > 0) {
      handleAiExtractRef.current();
    }
  }, [aiExtractTrigger]);

  const handleGrammarCheck = useCallback(async () => {
    if (!content.trim()) {
      message.warning('笔记内容为空');
      return;
    }
    try {
      const issues = await checkGrammar(content);
      setGrammarIssues(issues);
      if (issues.length === 0) {
        message.success('未发现语法问题');
      }
    } catch (error) {
      message.error('语法检查失败');
    }
  }, [content]);

  const handleGrammarCheckRef = useRef(handleGrammarCheck);
  handleGrammarCheckRef.current = handleGrammarCheck;

  // 外部触发语法检查（菜单）— 用 ref 避免 content 变化时重复触发
  useEffect(() => {
    if (grammarCheckTrigger !== undefined && grammarCheckTrigger > 0) {
      handleGrammarCheckRef.current();
    }
  }, [grammarCheckTrigger]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          handleSaveRef.current();
        } else if (e.key === 'b') {
          e.preventDefault();
          handleInsertRef.current('bold');
        } else if (e.key === 'i') {
          e.preventDefault();
          handleInsertRef.current('italic');
        }
      }
    },
    [],
  );

  if (!note) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <input
          className="editor-title-input"
          value={title}
          onChange={(e) => { isDirtyRef.current = true; setTitle(e.target.value); }}
          placeholder="输入笔记标题..."
        />
        <Select
          mode="multiple"
          placeholder="标签"
          value={noteTagIds}
          onChange={handleTagChange}
          style={{ minWidth: 120, maxWidth: 250 }}
          options={availableTags.map((t) => ({ label: t.name, value: t.id }))}
          size="small"
          maxTagCount="responsive"
        />
        <Space>
          {saving && <span className="save-status">保存中...</span>}
          <Tooltip title="保存">
            <Button icon={<SaveOutlined />} onClick={handleSave} />
          </Tooltip>
          <Tooltip title="AI摘要">
            <Button icon={<RobotOutlined />} onClick={handleAiSummary} />
          </Tooltip>
          <Tooltip title="语法检查">
            <Button onClick={handleGrammarCheck}>检查</Button>
          </Tooltip>
          <Tooltip title="编辑模式">
            <Button
              icon={<EditOutlined />}
              type={viewMode === 'edit' ? 'primary' : 'default'}
              onClick={() => onViewModeChange('edit')}
            />
          </Tooltip>
          <Tooltip title="预览模式">
            <Button
              icon={<EyeOutlined />}
              type={viewMode === 'preview' ? 'primary' : 'default'}
              onClick={() => onViewModeChange('preview')}
            />
          </Tooltip>
          <Tooltip title="分屏模式">
            <Button
              icon={<ColumnWidthOutlined />}
              type={viewMode === 'split' ? 'primary' : 'default'}
              onClick={() => onViewModeChange('split')}
            />
          </Tooltip>
        </Space>
      </div>

      {viewMode !== 'preview' && (
        <Toolbar onInsert={handleInsert} />
      )}

      <div className={`editor-body editor-${viewMode}`}>
        {viewMode !== 'preview' && (
          <div className="editor-input-panel">
            <textarea
              ref={editorRef}
              className="editor-textarea"
              value={content}
              onChange={(e) => { isDirtyRef.current = true; setContent(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder="开始编写Markdown笔记..."
              spellCheck={false}
            />
          </div>
        )}

        {viewMode !== 'edit' && (
          <div className="editor-preview-panel">
            <Preview content={content} />
          </div>
        )}
      </div>

      {showAiPanel && aiSummary && (
        <div className="ai-panel">
          <div className="ai-panel-header">
            <span>AI分析结果</span>
            <Button type="text" size="small" onClick={() => setShowAiPanel(false)}>
              关闭
            </Button>
          </div>
          <div className="ai-panel-content">
            <h4>摘要</h4>
            <p>{aiSummary.summary}</p>
            <h4>关键词</h4>
            <div className="keywords">
              {aiSummary.keywords.map((kw, i) => (
                <span key={i} className="keyword-tag">
                  {kw}
                </span>
              ))}
            </div>
            <h4>关键知识点</h4>
            <ul>
              {aiSummary.keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showExtractPanel && extractedPoints.length > 0 && (
        <div className="ai-panel">
          <div className="ai-panel-header">
            <span>知识点提取 ({extractedPoints.length}个)</span>
            <Button type="text" size="small" onClick={() => setShowExtractPanel(false)}>
              关闭
            </Button>
          </div>
          <div className="ai-panel-content">
            <ul>
              {extractedPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {grammarIssues.length > 0 && (
        <div className="grammar-panel">
          <div className="grammar-panel-header">
            <span>语法检查结果 ({grammarIssues.length}个问题)</span>
            <Button type="text" size="small" onClick={() => setGrammarIssues([])}>
              关闭
            </Button>
          </div>
          <ul>
            {grammarIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Editor;
