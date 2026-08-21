import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { ExportChapter, ExportProject } from './pdf.ts';

const MARKET_LABEL: Record<string, string> = { china: '中国', global: '欧美', latam: '拉美' };

/** 将单集分镜纯文本转换为 docx 段落列表。 */
function chapterParagraphs(ch: ExportChapter): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `第${ch.episodeNumber}集${ch.title ? ` · ${ch.title}` : ''}`, bold: true })],
      spacing: { before: 360, after: 200 },
    }),
  );

  for (const raw of ch.content.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') continue;
    const trimmed = line.trim();
    if (/^\d+-\d+\s/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line, bold: true, color: '6C5CE7' })],
          spacing: { before: 160, after: 40 },
        }),
      );
    } else if (/^人物[：:]/.test(trimmed)) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: line, bold: true })] }));
    } else if (trimmed.startsWith('△')) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: line })] }));
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line })],
          indent: { firstLine: 480 },
        }),
      );
    }
  }
  return paragraphs;
}

/** 构建并返回 .docx Buffer。 */
export async function buildWordDoc(project: ExportProject, chapters: ExportChapter[]): Promise<Buffer> {
  const children: Paragraph[] = [];
  const market = MARKET_LABEL[project.market] ?? project.market;
  const genres = project.genres?.join('、') || '（未选择）';
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: project.name, bold: true, size: 48 })],
      spacing: { after: 400 },
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `题材：${genres}` })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `市场：${market}` })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `集数：${project.episodes} 集 · 总时长 ${project.durationMin} 分钟` })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `生成日期：${dateStr}` })],
      pageBreakBefore: false,
    }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
  );

  for (const ch of chapters) {
    children.push(...chapterParagraphs(ch));
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
