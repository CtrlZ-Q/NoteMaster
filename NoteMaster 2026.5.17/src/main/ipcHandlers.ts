import { BrowserWindow, dialog, app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { createChannelRegistry } from './ipcUtils';

const { safeHandle, removeAll: removeHandledChannels } = createChannelRegistry();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// 允许读写的目录白名单
const ALLOWED_ROOTS: string[] = [];

function getAllowedRoots(): string[] {
  if (ALLOWED_ROOTS.length === 0) {
    ALLOWED_ROOTS.push(app.getPath('userData'));
    ALLOWED_ROOTS.push(app.getPath('documents'));
  }
  return ALLOWED_ROOTS;
}

// AI 配置文件路径
function getAIConfigPath(): string {
  return path.join(app.getPath('userData'), 'ai-config.enc');
}

function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return getAllowedRoots().some((root) => resolved.startsWith(path.resolve(root) + path.sep) || resolved === path.resolve(root));
}

// 检查路径是否为符号链接，防止路径穿越
async function isSymlink(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(filePath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // 文件对话框：打开文件
  safeHandle('dialog:openFile', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { filePath, content };
      } catch (error) {
        console.error('读取文件失败:', (error as Error).message);
        return { filePath, content: '', error: '文件读取失败' };
      }
    }
    return null;
  });

  // 文件对话框：保存文件
  safeHandle('dialog:saveFile', async (_, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: options?.filters || [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'HTML', extensions: ['html'] },
        { name: 'PDF', extensions: ['pdf'] },
      ],
    });
    if (!result.canceled && result.filePath) {
      return result.filePath;
    }
    return null;
  });

  // 读取文件（路径校验 + 符号链接检查 + 大小限制）
  safeHandle('file:read', async (_, filePath: string) => {
    try {
      if (!isPathAllowed(filePath)) {
        return { success: false, error: '路径不在允许范围内' };
      }
      if (await isSymlink(filePath)) {
        return { success: false, error: '不允许读取符号链接' };
      }
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_FILE_SIZE) {
        return { success: false, error: `文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），最大允许50MB` };
      }
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 写入文件（路径校验 + 符号链接检查 + 大小限制）
  safeHandle('file:write', async (_, filePath: string, content: string) => {
    try {
      if (!isPathAllowed(filePath)) {
        return { success: false, error: '路径不在允许范围内' };
      }
      if (await isSymlink(filePath)) {
        return { success: false, error: '不允许写入符号链接' };
      }
      if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE) {
        return { success: false, error: '写入内容过大，最大允许50MB' };
      }
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取用户数据路径
  safeHandle('app:getUserData', () => {
    return app.getPath('userData');
  });

  // 获取应用版本
  safeHandle('app:getVersion', () => {
    return app.getVersion();
  });

  // 最小化窗口
  safeHandle('window:minimize', () => {
    if (!mainWindow.isDestroyed()) mainWindow.minimize();
  });

  // 最大化/还原窗口
  safeHandle('window:toggleMaximize', () => {
    if (mainWindow.isDestroyed()) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  // 关闭窗口
  safeHandle('window:close', () => {
    if (!mainWindow.isDestroyed()) mainWindow.close();
  });

  // AI 配置读取（API key 用 safeStorage 加密存储）
  safeHandle('ai:getConfig', async () => {
    const configPath = getAIConfigPath();
    try {
      const encrypted = await fs.readFile(configPath);
      const decrypted = safeStorage.decryptString(encrypted);
      const config = JSON.parse(decrypted);
      // 不返回 apiKey 给 renderer
      return { endpoint: config.endpoint || '', model: config.model || '', hasKey: !!config.apiKey };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') return null;
      console.error('读取AI配置失败:', err.message);
      return null;
    }
  });

  // AI API 调用（在 main process 执行，不暴露 key 给 renderer）
  safeHandle('ai:call', async (_, params: { prompt: string; content: string }) => {
    const configPath = getAIConfigPath();
    let config: { apiKey: string; endpoint: string; model: string };
    try {
      const encrypted = await fs.readFile(configPath);
      config = JSON.parse(safeStorage.decryptString(encrypted));
    } catch {
      throw new Error('AI配置未设置或读取失败');
    }
    if (!config.apiKey) throw new Error('API密钥未配置');

    const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
    const model = config.model || 'gpt-3.5-turbo';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是一个专业的笔记助手，帮助用户整理和分析学习笔记。请严格按要求的JSON格式返回。' },
            { role: 'user', content: `${params.prompt}\n\n${params.content}` },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0]) {
        throw new Error('API返回数据格式异常');
      }
      return data.choices[0]?.message?.content || '无法生成结果';
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('API请求超时（30秒）');
      }
      throw error;
    }
  });

  // AI 配置保存
  safeHandle('ai:saveConfig', async (_, config: { apiKey: string; endpoint: string; model: string }) => {
    if (!config || typeof config !== 'object') throw new Error('配置格式无效');
    if (typeof config.apiKey !== 'string' || config.apiKey.length > 500) throw new Error('apiKey 格式无效');
    if (typeof config.endpoint !== 'string' || config.endpoint.length > 2000) throw new Error('endpoint 格式无效');
    // 校验 endpoint 为合法 http/https URL
    if (config.endpoint) {
      try {
        const url = new URL(config.endpoint);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('endpoint 必须使用 http 或 https 协议');
        }
      } catch (e) {
        if ((e as Error).message.includes('endpoint 必须')) throw e;
        throw new Error('endpoint URL 格式无效');
      }
    }
    if (typeof config.model !== 'string' || config.model.length > 200) throw new Error('model 格式无效');
    try {
      let finalConfig = config;
      if (!config.apiKey) {
        try {
          const existing = await fs.readFile(getAIConfigPath());
          const existingConfig = JSON.parse(safeStorage.decryptString(existing));
          finalConfig = { ...config, apiKey: existingConfig.apiKey };
        } catch {
          throw new Error('API密钥未配置');
        }
      }
      const encrypted = safeStorage.encryptString(JSON.stringify(finalConfig));
      await fs.writeFile(getAIConfigPath(), encrypted);
    } catch (error) {
      const msg = (error as Error).message;
      if (msg === 'API密钥未配置') throw error;
      console.error('保存AI配置失败:', msg);
      throw new Error('保存配置失败');
    }
  });
}

export function removeIpcHandlers(): void {
  removeHandledChannels();
}
