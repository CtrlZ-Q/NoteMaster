import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import katex from 'katex';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

interface PreviewProps {
  content: string;
}

// 初始化markdown-it
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      } catch {
        // ignore
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

// 数学公式渲染插件
function mathPlugin(md: MarkdownIt): void {
  // 行内公式 $...$
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
    if (silent) return false;

    const start = state.pos + 1;
    let end = start;
    while (end < state.src.length && state.src.charCodeAt(end) !== 0x24) {
      end++;
    }
    if (end >= state.src.length) return false;
    if (end === start) return false;

    // 避免误解析 $10 and $20 这种纯数字开头的内容
    const content = state.src.slice(start, end);
    if (/^\d/.test(content)) return false;

    state.pos = start;
    const token = state.push('math_inline', 'math', 0);
    token.content = content;
    token.markup = '$';
    state.pos = end + 1;
    return true;
  });

  // 块级公式 $$...$$
  md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
    const startPos = state.bMarks[startLine] + state.tShift[startLine];
    const maxPos = state.eMarks[startLine];

    if (state.src.slice(startPos, startPos + 2) !== '$$') return false;
    if (silent) return true;

    let nextLine = startLine + 1;
    while (nextLine < endLine) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineEnd = state.eMarks[nextLine];
      if (state.src.slice(lineStart, lineStart + 2) === '$$') {
        const token = state.push('math_block', 'math', 0);
        token.content = state.getLines(startLine + 1, nextLine, 0, false);
        token.markup = '$$';
        token.map = [startLine, nextLine + 1];
        state.line = nextLine + 1;
        return true;
      }
      nextLine++;
    }
    return false;
  });

  // 渲染规则
  md.renderer.rules.math_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: false });
    } catch {
      return `<span class="math-error">${md.utils.escapeHtml(tokens[idx].content)}</span>`;
    }
  };

  md.renderer.rules.math_block = (tokens, idx) => {
    try {
      return `<div class="math-block">${katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: true })}</div>`;
    } catch {
      return `<div class="math-error">${md.utils.escapeHtml(tokens[idx].content)}</div>`;
    }
  };
}

// 任务列表插件
function taskListPlugin(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'task_list', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'inline') {
        const content = tokens[i].content;
        if (content.startsWith('[ ] ') || content.startsWith('[x] ') || content.startsWith('[X] ')) {
          const checked = content.startsWith('[x] ') || content.startsWith('[X] ');
          tokens[i].content = content.slice(4);
          tokens[i].children = [];
          const checkboxToken = new state.Token('html_inline', '', 0);
          checkboxToken.content = `<input type="checkbox" ${checked ? 'checked' : ''} disabled /> `;
          tokens[i].children!.push(checkboxToken);
          const textToken = new state.Token('text', '', 0);
          textToken.content = content.slice(4);
          tokens[i].children!.push(textToken);
        }
      }
    }
  });
}

// 注册插件
md.use(mathPlugin);
md.use(taskListPlugin);

const Preview: React.FC<PreviewProps> = ({ content }) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '<p class="empty-hint">暂无内容</p>';
    try {
      const raw = md.render(content);
      return DOMPurify.sanitize(raw, {
        USE_PROFILES: { mathMl: true },
        ADD_TAGS: ['input'],
        ADD_ATTR: ['xmlns', 'encoding', 'type', 'checked', 'disabled'],
      });
    } catch (error) {
      return '<p class="render-error">渲染出错</p>';
    }
  }, [content]);

  return (
    <div
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

export default Preview;
