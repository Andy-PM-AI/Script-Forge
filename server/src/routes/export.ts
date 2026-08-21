import { Hono } from 'hono';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.ts';
import { episodes, scripts } from '../db/schema.ts';
import { getProject, projectIdOf } from '../lib/helpers.ts';
import { parseJson } from '../lib/validate.ts';
import { exportFilename } from '../lib/parse.ts';
import { renderPdf, buildScriptHtml, type ExportChapter, type ExportProject } from '../lib/export/pdf.ts';
import { buildWordDoc } from '../lib/export/word.ts';

const exportSchema = z.object({
  scope: z.enum(['all', 'episode']).default('all'),
  episode_number: z.number().int().positive().nullable().optional(),
});

export const exportRoute = new Hono();

/** 读取导出所需的项目与章节内容。 */
async function loadChapters(
  projectId: string,
  scope: string,
  episodeNumber?: number | null,
): Promise<{ project: ExportProject; chapters: ExportChapter[] }> {
  const project = await getProject(projectId);

  const epRows = await db
    .select()
    .from(episodes)
    .where(eq(episodes.projectId, projectId))
    .orderBy(asc(episodes.episodeNumber));
  const scriptRows = await db
    .select()
    .from(scripts)
    .where(eq(scripts.projectId, projectId))
    .orderBy(asc(scripts.episodeNumber));

  const titleByNumber = new Map(epRows.map((e) => [e.episodeNumber, e.title]));
  const contentByNumber = new Map(scriptRows.map((s) => [s.episodeNumber, s.content ?? '']));

  let numbers = scriptRows.map((s) => s.episodeNumber);
  if (scope === 'episode') {
    if (!episodeNumber) throw new HTTPException(400, { message: '导出单集时需提供 episode_number' });
    numbers = numbers.filter((n) => n === episodeNumber);
  }

  const chapters: ExportChapter[] = numbers.map((n) => ({
    episodeNumber: n,
    title: titleByNumber.get(n) ?? null,
    content: contentByNumber.get(n) ?? '',
  }));

  return {
    project: {
      name: project.name,
      market: project.market,
      genres: project.genres ?? [],
      episodes: project.episodes,
      durationMin: project.durationMin,
    },
    chapters,
  };
}

function fileResponse(data: Uint8Array, filename: string, mime: string): Response {
  return new Response(data, {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

exportRoute.post('/export/pdf', async (c) => {
  const project = await getProject(projectIdOf(c));
  const body = await parseJson(c, exportSchema);
  const { project: p, chapters } = await loadChapters(project.id, body.scope, body.episode_number);
  const pdf = await renderPdf(buildScriptHtml(p, chapters));
  const filename = exportFilename(project.name, 'pdf', body.scope === 'episode' ? body.episode_number ?? undefined : undefined);
  return fileResponse(new Uint8Array(pdf), filename, 'application/pdf');
});

exportRoute.post('/export/word', async (c) => {
  const project = await getProject(projectIdOf(c));
  const body = await parseJson(c, exportSchema);
  const { project: p, chapters } = await loadChapters(project.id, body.scope, body.episode_number);
  const buffer = await buildWordDoc(p, chapters);
  const filename = exportFilename(project.name, 'docx', body.scope === 'episode' ? body.episode_number ?? undefined : undefined);
  return fileResponse(
    new Uint8Array(buffer),
    filename,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
});

exportRoute.post('/export/feishu', async () => {
  throw new HTTPException(501, { message: '飞书导出尚未实现，需先完成飞书 OAuth 授权' });
});
