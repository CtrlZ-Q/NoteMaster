/**
 * AI服务层
 * 有 API key 时调用远程 LLM（通过 main process IPC），否则降级为本地实现
 */

import { AISummary } from '../types';

// 检查是否配置了 AI
async function hasAIConfig(): Promise<boolean> {
  try {
    const cfg = await window.electronAPI.getAIConfig();
    return !!(cfg && cfg.hasKey);
  } catch {
    return false;
  }
}

// 通过 main process 调用 AI API（key 不暴露给 renderer）
async function callAI(prompt: string, content: string): Promise<string> {
  return window.electronAPI.callAI({ prompt, content });
}

export async function generateSummary(content: string): Promise<AISummary> {
  if (await hasAIConfig()) {
    try {
      const result = await callAI(
        '请分析以下笔记内容，返回JSON格式：{"summary":"摘要(100字内)","keywords":["关键词1","关键词2",...],"keyPoints":["知识点1","知识点2",...]}',
        content,
      );
      const parsed = JSON.parse(result);
      return {
        summary: parsed.summary || '',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      };
    } catch {
      // 降级到本地实现
    }
  }

  // 本地实现
  const keywords = extractKeywords(content);
  const keyPoints = extractKeyPoints(content);
  const summary = generateLocalSummary(content);
  return { summary, keywords, keyPoints };
}

export async function extractKnowledge(content: string): Promise<string[]> {
  if (await hasAIConfig()) {
    try {
      const result = await callAI(
        '请从以下笔记中提取核心知识点，返回JSON数组格式：["知识点1","知识点2",...]',
        content,
      );
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // 降级
    }
  }

  return extractKeyPoints(content);
}

export async function checkGrammar(content: string): Promise<string[]> {
  if (await hasAIConfig()) {
    try {
      const result = await callAI(
        '请检查以下Markdown笔记的语法和格式问题，返回JSON数组格式，每个元素是一个问题描述字符串：["问题1","问题2",...]。只返回JSON，不要其他内容。',
        content,
      );
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // 降级到本地实现
    }
  }

  const issues: string[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStartLine = lineNum;
      } else {
        inCodeBlock = false;
        codeBlockStartLine = -1;
      }
    }

    if (!inCodeBlock && line.match(/^#{1,6}\s/)) {
      const level = line.match(/^(#+)/)?.[1].length || 0;
      if (i > 0) {
        const prevLine = lines.slice(0, i).reverse().find((l) => l.match(/^#{1,6}\s/));
        if (prevLine) {
          const prevLevel = prevLine.match(/^(#+)/)?.[1].length || 0;
          if (level > prevLevel + 1) {
            issues.push(`第${lineNum}行：标题层级跳跃，从h${prevLevel}直接到h${level}`);
          }
        }
      }
    }

    const linkMatch = line.match(/\[([^\]]*)\]\(([^)]*)\)/g);
    if (linkMatch) {
      for (const match of linkMatch) {
        const href = match.match(/\]\(([^)]*)\)/)?.[1];
        if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('/')) {
          issues.push(`第${lineNum}行：链接地址可能无效 "${href}"`);
        }
      }
    }

    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]*)\)/g);
    if (imgMatch) {
      for (const match of imgMatch) {
        const src = match.match(/\]\(([^)]*)\)/)?.[1];
        if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('./')) {
          issues.push(`第${lineNum}行：图片路径可能无效 "${src}"`);
        }
      }
    }
  }

  if (inCodeBlock) {
    issues.push(`第${codeBlockStartLine}行：代码块未正确闭合`);
  }

  if (content.includes(']()')) {
    issues.push('存在空链接，请检查');
  }

  const headings = content.match(/^#{1,6}\s+.+$/gm) || [];
  const headingMap = new Map<string, number>();
  for (const heading of headings) {
    const text = heading.replace(/^#+\s+/, '');
    const count = (headingMap.get(text) || 0) + 1;
    headingMap.set(text, count);
    if (count === 2) {
      issues.push(`存在重复标题："${text}"`);
    }
  }

  return issues;
}

// --- 本地实现 ---

function extractKeywords(text: string): string[] {
  const cleanText = text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[^一-龥a-zA-Z0-9\s]/g, ' ');

  const words = cleanText
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => w.toLowerCase());

  const wordCount = new Map<string, number>();
  for (const word of words) {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  }

  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function extractKeyPoints(text: string): string[] {
  const points: string[] = [];

  const headings = text.match(/^#{1,3}\s+.+$/gm) || [];
  for (const heading of headings) {
    const point = heading.replace(/^#+\s+/, '').trim();
    if (point.length > 0 && point.length < 50) {
      points.push(point);
    }
  }

  const listItems = text.match(/^[\s]*[-*+]\s+.+$/gm) || [];
  for (const item of listItems.slice(0, 5)) {
    const point = item.replace(/^[\s]*[-*+]\s+/, '').trim();
    if (point.length > 5 && point.length < 100) {
      points.push(point);
    }
  }

  const boldItems = text.match(/\*{2}([^*]+)\*{2}/g) || [];
  for (const item of boldItems.slice(0, 3)) {
    const point = item.replace(/\*{2}/g, '').trim();
    if (point.length > 2 && point.length < 50) {
      points.push(point);
    }
  }

  return [...new Set(points)].slice(0, 10);
}

function generateLocalSummary(text: string): string {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const summaryParts: string[] = [];

  for (const para of paragraphs.slice(0, 3)) {
    const clean = para
      .replace(/#{1,6}\s/g, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim();

    if (clean.length > 10) {
      summaryParts.push(clean.substring(0, 100));
    }
  }

  return summaryParts.length > 0 ? summaryParts.join('。') + '。' : '暂无内容可生成摘要。';
}
