import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Layout, message, Spin, ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Sidebar from './components/Sidebar/Sidebar';
import Editor from './components/Editor/Editor';
import NoteList from './components/Notebook/NoteList';
import SearchBar from './components/Search/SearchBar';
import KnowledgeGraph from './components/Graph/KnowledgeGraph';
import ExportDialog from './components/Export/ExportDialog';
import TagManager from './components/Tags/TagManager';
import SettingsDialog from './components/Settings/SettingsDialog';
import HelpDialog from './components/Help/HelpDialog';
import { rebuildSearchIndex, addNoteToIndex } from './services/searchService';
import { getNotes, createNote } from './services/noteService';
import { Note, ViewMode, NoteFilter } from './types';

const { Content, Sider } = Layout;

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [notes, setNotes] = useState<Note[]>([]);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('nm-theme') === 'dark'; } catch { return false; }
  });
  const [searchVisible, setSearchVisible] = useState(false);
  const [graphVisible, setGraphVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'html' | 'image'>('html');
  const [tagManagerVisible, setTagManagerVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [saveTrigger, setSaveTrigger] = useState(0);
  const [aiSummaryTrigger, setAiSummaryTrigger] = useState(0);
  const [aiExtractTrigger, setAiExtractTrigger] = useState(0);
  const [grammarCheckTrigger, setGrammarCheckTrigger] = useState(0);
  const [newFolderTrigger, setNewFolderTrigger] = useState(0);

  // 用 ref 缓存频繁变化的值，避免菜单事件监听器频繁重注册
  const selectedNoteIdRef = useRef(selectedNoteId);
  const selectedFolderIdRef = useRef(selectedFolderId);
  useEffect(() => { selectedNoteIdRef.current = selectedNoteId; }, [selectedNoteId]);
  useEffect(() => { selectedFolderIdRef.current = selectedFolderId; }, [selectedFolderId]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await rebuildSearchIndex();
        const loadedNotes = await getNotes();
        if (cancelled) return;
        setNotes(loadedNotes);
        if (loadedNotes.length > 0) {
          setSelectedNoteId(loadedNotes[0].id);
        }
        setLoading(false);
      } catch (error) {
        if (!cancelled) {
          console.error('应用初始化失败:', error);
          message.error('应用初始化失败，请重试');
          setLoading(false);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  const refreshNotes = useCallback(async () => {
    try {
      const filter: NoteFilter = {};
      if (selectedFolderId !== null) filter.folderId = selectedFolderId;
      if (selectedTag) filter.tag = selectedTag;
      if (isFavorite) filter.isFavorite = true;
      if (isDeleted) filter.isDeleted = true;
      const loadedNotes = await getNotes(filter);
      setNotes(loadedNotes);
    } catch (error) {
      console.error('刷新笔记列表失败:', error);
    }
  }, [selectedFolderId, selectedTag, isFavorite, isDeleted]);

  const handleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
  }, []);

  const handleSelectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
    setSelectedTag(null);
    setIsFavorite(false);
    setIsDeleted(false);
  }, []);

  const handleSelectTag = useCallback((tagName: string | null) => {
    setSelectedTag(tagName);
    setSelectedFolderId(null);
    setIsFavorite(false);
    setIsDeleted(false);
  }, []);

  const handleSelectFavorite = useCallback(() => {
    setSelectedFolderId(null);
    setSelectedTag(null);
    setIsFavorite(true);
    setIsDeleted(false);
  }, []);

  const handleSelectTrash = useCallback(() => {
    setSelectedFolderId(null);
    setSelectedTag(null);
    setIsFavorite(false);
    setIsDeleted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try { localStorage.setItem('nm-theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  }, []);

  // 同步 body data-theme 属性
  useEffect(() => {
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleNewNote = useCallback(() => {
    setSidebarRefreshKey((k) => k + 1);
    refreshNotes();
  }, [refreshNotes]);

  // 注册菜单事件监听 — 通过 ref 读取最新值，避免频繁重注册
  useEffect(() => {
    const cleanups = [
      window.electronAPI.onMenuNewNote(async () => {
        const note = await createNote('无标题笔记', selectedFolderIdRef.current);
        addNoteToIndex(note);
        handleNewNote();
      }),
      window.electronAPI.onMenuNewFolder(() => {
        setNewFolderTrigger((t) => t + 1);
      }),
      window.electronAPI.onMenuSave(() => {
        setSaveTrigger((t) => t + 1);
      }),
      window.electronAPI.onMenuSaveAll(() => {
        setSaveTrigger((t) => t + 1);
      }),
      window.electronAPI.onMenuImport(async () => {
        try {
          const result = await window.electronAPI.openFile({
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
          });
          if (result) {
            const title = result.filePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || '导入的笔记';
            const note = await createNote(title, selectedFolderIdRef.current, result.content);
            addNoteToIndex(note);
            handleNewNote();
            message.success('导入成功');
          }
        } catch {
          message.error('导入失败');
        }
      }),
      window.electronAPI.onMenuExport((format: string) => {
        if (selectedNoteIdRef.current) {
          setExportFormat((format as 'pdf' | 'html' | 'image') || 'html');
          setExportVisible(true);
        } else {
          message.warning('请先选择一篇笔记');
        }
      }),
      window.electronAPI.onMenuView((mode: string) => {
        setViewMode(mode as ViewMode);
      }),
      window.electronAPI.onMenuFind(() => {
        setSearchVisible(true);
      }),
      window.electronAPI.onMenuReplace(() => {
        setSearchVisible(true);
      }),
      window.electronAPI.onMenuGraph(() => {
        setGraphVisible(true);
      }),
      window.electronAPI.onMenuAiSummary(() => {
        setAiSummaryTrigger((t) => t + 1);
      }),
      window.electronAPI.onMenuAiExtract(() => {
        setAiExtractTrigger((t) => t + 1);
      }),
      window.electronAPI.onMenuAiCheck(() => {
        setGrammarCheckTrigger((t) => t + 1);
      }),
      window.electronAPI.onMenuSettings(() => {
        setSettingsVisible(true);
      }),
      window.electronAPI.onMenuHelp(() => {
        setHelpVisible(true);
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [handleNewNote]);

  // 筛选条件变化时刷新笔记列表
  useEffect(() => {
    if (!loading) {
      refreshNotes();
    }
  }, [selectedFolderId, selectedTag, isFavorite, isDeleted, loading, refreshNotes]);

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      if (noteId === selectedNoteId) {
        setSelectedNoteId(null);
      }
      setSidebarRefreshKey((k) => k + 1);
      refreshNotes();
    },
    [selectedNoteId, refreshNotes],
  );

  if (loading) {
    return (
      <ConfigProvider locale={zhCN} theme={isDark ? { algorithm: antdTheme.darkAlgorithm } : {}}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
          }}
        >
          <Spin size="large" tip="正在加载 NoteMaster..." />
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={zhCN} theme={isDark ? { algorithm: antdTheme.darkAlgorithm } : {}}>
      <Layout style={{ height: '100vh' }}>
        <Sider
          width={240}
          collapsedWidth={0}
          theme={isDark ? 'dark' : 'light'}
          style={{
            borderRight: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
            overflow: 'auto',
          }}
        >
          <Sidebar
            selectedFolderId={selectedFolderId}
            selectedTag={selectedTag}
            isFavorite={isFavorite}
            isDeleted={isDeleted}
            refreshKey={sidebarRefreshKey}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            onSelectFolder={handleSelectFolder}
            onSelectTag={handleSelectTag}
            onSelectFavorite={handleSelectFavorite}
            onSelectTrash={handleSelectTrash}
            onNewNote={handleNewNote}
            newFolderTrigger={newFolderTrigger}
            onOpenTagManager={() => setTagManagerVisible(true)}
          />
        </Sider>

        <Layout>
          <Sider
            width={300}
            collapsedWidth={0}
            theme={isDark ? 'dark' : 'light'}
            style={{
              borderRight: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
              overflow: 'auto',
            }}
          >
            <NoteList
              notes={notes}
              selectedNoteId={selectedNoteId}
              isDeleted={isDeleted}
              onSelectNote={handleSelectNote}
              onDeleteNote={handleDeleteNote}
              onRefresh={refreshNotes}
              folderId={selectedFolderId}
              tag={selectedTag}
            />
          </Sider>

          <Content style={{ overflow: 'hidden' }}>
            {selectedNoteId ? (
              <Editor
                noteId={selectedNoteId}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onSave={refreshNotes}
                saveTrigger={saveTrigger}
                aiSummaryTrigger={aiSummaryTrigger}
                aiExtractTrigger={aiExtractTrigger}
                grammarCheckTrigger={grammarCheckTrigger}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  color: isDark ? '#666' : '#999',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ color: isDark ? '#555' : '#bbb' }}>欢迎使用 NoteMaster</h2>
                  <p>选择一篇笔记开始编辑，或创建一篇新笔记</p>
                </div>
              </div>
            )}
          </Content>
        </Layout>
      </Layout>

      <SearchBar
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectNote={(noteId) => {
          setSelectedNoteId(noteId);
          setSearchVisible(false);
        }}
      />

      <KnowledgeGraph
        visible={graphVisible}
        onClose={() => setGraphVisible(false)}
        onSelectNote={(noteId) => {
          setSelectedNoteId(noteId);
          setGraphVisible(false);
        }}
      />

      <ExportDialog
        visible={exportVisible}
        noteId={selectedNoteId}
        defaultFormat={exportFormat}
        onClose={() => setExportVisible(false)}
      />

      <TagManager
        visible={tagManagerVisible}
        onClose={() => setTagManagerVisible(false)}
        onTagsChange={() => setSidebarRefreshKey((k) => k + 1)}
      />

      <SettingsDialog
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        isDark={isDark}
        onThemeChange={(dark) => {
          setIsDark(dark);
          try { localStorage.setItem('nm-theme', dark ? 'dark' : 'light'); } catch {}
        }}
      />

      <HelpDialog
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
      />
    </ConfigProvider>
  );
};

export default App;
