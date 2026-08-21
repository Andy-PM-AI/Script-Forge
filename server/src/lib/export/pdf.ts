import puppeteer from 'puppeteer';

const MARKET_LABEL: Record<string, string> = { china: '中国', global: '欧美', latam: '拉美' };

export interface ExportChapter {
  episodeNumber: number;
  title: string | null;
  content: string;
}

export interface ExportProject {
  name: string;
  market: string;
  genres: string[];
  episodes: number;
  durationMin: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 将单集分镜纯文本渲染为 HTML 片段。 */
function renderChapter(ch: ExportChapter): string {
  const lines = ch.content.split('\n');
  const parts: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      parts.push('<div class="gap"></div>');
      continue;
    }
    const trimmed = line.trim();
    if (/^\d+-\d+\s/.test(trimmed)) {
      parts.push(`<h3 class="scene">${escapeHtml(line)}</h3>`);
    } else if (/^人物[：:]/.test(trimmed)) {
      parts.push(`<p class="cast">${escapeHtml(line)}</p>`);
    } else if (trimmed.startsWith('△')) {
      parts.push(`<p class="action">${escapeHtml(line)}</p>`);
    } else {
      parts.push(`<p class="dialogue">${escapeHtml(line)}</p>`);
    }
  }
  return `<h2 class="episode">第${ch.episodeNumber}集${ch.title ? ` · ${escapeHtml(ch.title)}` : ''}</h2>${parts.join('')}`;
}

export function buildScriptHtml(project: ExportProject, chapters: ExportChapter[]): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const market = MARKET_LABEL[project.market] ?? project.market;
  const genres = project.genres?.join('、') || '（未选择）';

  const cover = `<div class="cover">
    <h1>${escapeHtml(project.name)}</h1>
    <p class="meta">题材：${escapeHtml(genres)}</p>
    <p class="meta">市场：${escapeHtml(market)}</p>
    <p class="meta">集数：${project.episodes} 集 · 总时长 ${project.durationMin} 分钟</p>
    <p class="meta">生成日期：${dateStr}</p>
  </div>`;

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif; color: #1a1a2e; font-size: 13px; line-height: 1.75; }
  .cover { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; page-break-after: always; }
  .cover h1 { font-size: 34px; margin-bottom: 28px; }
  .cover .meta { font-size: 15px; color: #555; margin: 4px 0; }
  h2.episode { font-size: 20px; margin: 28px 0 12px; page-break-before: always; border-bottom: 2px solid #6C5CE7; padding-bottom: 8px; }
  h3.scene { font-size: 14px; font-weight: 700; margin: 14px 0 6px; color: #6C5CE7; }
  p { margin: 4px 0; }
  p.cast { color: #444; font-weight: 600; }
  p.action { color: #222; }
  p.dialogue { text-indent: 2em; }
  .gap { height: 8px; }
</style>
</head>
<body>
${cover}
${chapters.map(renderChapter).join('')}
</body>
</html>`;
}

/** 渲染 HTML 并输出 PDF Buffer。 */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
