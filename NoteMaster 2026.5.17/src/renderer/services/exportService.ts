/**
 * 导出服务层
 * 支持导出为PDF、HTML、图片格式
 */

import DOMPurify from 'dompurify';
import { ExportOptions, Note } from '../types';

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { mathMl: true },
    ADD_TAGS: ['input'],
    ADD_ATTR: ['xmlns', 'encoding', 'type', 'checked', 'disabled'],
  });
}

/**
 * 导出为HTML
 */
export function exportToHTML(note: Note, renderedHtml: string, includeStyles: boolean = true): string {
  const styleTag = includeStyles ? `<style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.8;
      color: #333;
    }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
    h2 { border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 30px; }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #1890ff;
      margin: 0;
      padding: 10px 20px;
      background: #f0f5ff;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #f5f5f5; }
    img { max-width: 100%; }
    .meta {
      color: #999;
      font-size: 0.9em;
      margin-bottom: 20px;
    }
    .tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .tag {
      background: #e6f7ff;
      color: #1890ff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85em;
    }
  </style>` : '';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(note.title)}</title>
  ${styleTag}
</head>
<body>
  <h1>${escapeHtml(note.title)}</h1>
  <div class="meta">
    <p>创建时间：${new Date(note.createdAt).toLocaleString('zh-CN')}</p>
    <p>更新时间：${new Date(note.updatedAt).toLocaleString('zh-CN')}</p>
    ${note.tags.length > 0 ? `<div class="tags">${note.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  </div>
  <hr>
  <article>
    ${sanitizeHtml(renderedHtml)}
  </article>
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 0.85em;">
    由 NoteMaster 导出
  </footer>
</body>
</html>`;

  return html;
}

/**
 * 导出为PDF（通过HTML中转）
 */
export async function exportToPDF(
  note: Note,
  renderedHtml: string,
  options?: Partial<ExportOptions>,
): Promise<void> {
  const htmlContent = exportToHTML(note, renderedHtml, options?.includeStyles ?? true);

  // 使用jsPDF生成PDF
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  // 创建临时容器（唯一ID避免并发冲突）
  const containerId = `nm-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const container = document.createElement('div');
  container.id = containerId;
  // 提取 body 内容，避免无效 HTML 嵌套
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  container.innerHTML = bodyMatch ? bodyMatch[1] : htmlContent;
  container.style.width = '210mm';
  container.style.padding = '15mm';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: options?.orientation || 'portrait',
      unit: 'mm',
      format: options?.pageSize || 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // First page
    let heightLeft = imgHeight;
    let yOffset = 0;

    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    heightLeft -= pdfHeight - 20;

    // Additional pages — each shows the next slice of the image
    while (heightLeft > 0) {
      yOffset -= pdfHeight - 20;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, 10 + yOffset, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 20;
    }

    pdf.save(`${sanitizeFilename(note.title)}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 导出为图片
 */
export async function exportToImage(
  note: Note,
  renderedHtml: string,
): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');

  const containerId = `nm-export-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const container = document.createElement('div');
  container.id = containerId;
  container.innerHTML = `
    <div style="padding: 40px; max-width: 900px; font-family: -apple-system, sans-serif;">
      <h1 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">${escapeHtml(note.title)}</h1>
      <div>${sanitizeHtml(renderedHtml)}</div>
    </div>
  `;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.background = 'white';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const link = document.createElement('a');
    link.download = `${sanitizeFilename(note.title)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 统一导出入口
 */
export async function exportNote(
  note: Note,
  renderedHtml: string,
  options: ExportOptions,
): Promise<void> {
  switch (options.format) {
    case 'html': {
      const html = exportToHTML(note, renderedHtml, options.includeStyles);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${sanitizeFilename(note.title)}.html`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
    case 'pdf':
      await exportToPDF(note, renderedHtml, options);
      break;
    case 'image':
      await exportToImage(note, renderedHtml);
      break;
  }
}

/**
 * HTML转义
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"|?*\\/]/g, '_')
    .replace(/[\x00-\x1f]/g, '')
    .substring(0, 200) || '笔记';
}
