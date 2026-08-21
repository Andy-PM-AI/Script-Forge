import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.ts';
import { aiFeedbackHistory, projects, segments } from '../db/schema.ts';
import { getProject, projectIdOf, serializeSegment } from '../lib/helpers.ts';
import { parseJson } from '../lib/validate.ts';
import { parseLabeled } from '../lib/parse.ts';
import { buildSegmentPrompt, buildFeedbackPrompt } from '../lib/prompt.ts';
import { generateText } from '../lib/ai.ts';
import { currentUserId } from '../lib/user.ts';
import { getCharactersForPrompt, getStep2Result } from '../lib/context.ts';
import { startSSE } from '../lib/sse.ts';
import { startTask, waitIfPaused, abortTask, clearTask } from '../lib/genRegistry.ts';

const patchSchema = z.object({
  title: z.string().nullable().optional(),
  hook: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  ending_hook: z.string().nullable().optional(),
});
const feedbackSchema = z.object({ feedback: z.string().min(1) });

export const step3Route = new Hono();

async function getSegment(projectId: string, segId: string) {
  const rows = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, segId), eq(segments.projectId, projectId)))
    .limit(1);
  if (rows.length === 0) throw new HTTPException(404, { message: '段落不存在' });
  return rows[0];
}

async function generateSegment(projectId: string, seg: typeof segments.$inferSelect, feedback?: string) {
  const [project, chars, step2] = await Promise.all([
    getProject(projectId),
    getCharactersForPrompt(projectId),
    getStep2Result(projectId),
  ]);
  const basePrompt = buildSegmentPrompt({
    market: project.market,
    episodes: project.episodes,
    durationMin: project.durationMin,
    characters: chars,
    background: step2?.background ?? '',
    storyline: step2?.storyline ?? '',
    range: { start: seg.episodeStart, end: seg.episodeEnd },
  });
  const current = [seg.hook, seg.summary, seg.endingHook].filter(Boolean).join('\n');
  const prompt = feedback ? buildFeedbackPrompt(basePrompt, feedback, current) : basePrompt;
  const text = await generateText(prompt, { step: 'segment' });
  const parsed = parseLabeled(text);
  const [updated] = await db
    .update(segments)
    .set({
      title: seg.title ?? `第${seg.sortOrder}段`,
      hook: parsed['开场钩子'] ?? '',
      summary: parsed['剧情简介'] ?? '',
      endingHook: parsed['结尾钩子'] ?? '',
      status: 'done',
    })
    .where(eq(segments.id, seg.id))
    .returning();
  return updated;
}

step3Route.get('/segments', async (c) => {
  const project = await getProject(projectIdOf(c));
  const rows = await db
    .select()
    .from(segments)
    .where(eq(segments.projectId, project.id))
    .orderBy(asc(segments.sortOrder));
  return c.json(rows.map(serializeSegment));
});

step3Route.post('/segments/generate', async (c) => {
  const project = await getProject(projectIdOf(c));
  const rows = await db
    .select()
    .from(segments)
    .where(eq(segments.projectId, project.id))
    .orderBy(asc(segments.sortOrder));
  if (rows.length === 0) return c.json({ completed: 0, total: 0 });

  startTask(project.id, rows.length);
  return startSSE(
    c,
    async (send) => {
      await send('start', { step: 3, total: rows.length });
      let completed = 0;
      for (const seg of rows) {
        await waitIfPaused(project.id);
        const updated = await generateSegment(project.id, seg);
        completed += 1;
        await send('done', { segment_id: updated.id, index: updated.sortOrder, ...serializeSegment(updated) });
        await send('progress', { completed, total: rows.length });
      }
      await db
        .update(projects)
        .set({ currentStep: Math.max(project.currentStep, 3) })
        .where(eq(projects.id, project.id));
      clearTask(project.id);
      await send('finish', { completed, total: rows.length });
    },
    () => abortTask(project.id),
  );
});

step3Route.post('/segments/:segId/generate', async (c) => {
  const project = await getProject(projectIdOf(c));
  const seg = await getSegment(project.id, c.req.param('segId'));
  return c.json(serializeSegment(await generateSegment(project.id, seg)));
});

step3Route.patch('/segments/:segId', async (c) => {
  const project = await getProject(projectIdOf(c));
  const seg = await getSegment(project.id, c.req.param('segId'));
  const body = await parseJson(c, patchSchema);
  const [updated] = await db.update(segments).set(body).where(eq(segments.id, seg.id)).returning();
  return c.json(serializeSegment(updated));
});

step3Route.post('/segments/:segId/feedback', async (c) => {
  const project = await getProject(projectIdOf(c));
  const seg = await getSegment(project.id, c.req.param('segId'));
  const { feedback } = await parseJson(c, feedbackSchema);
  await db.insert(aiFeedbackHistory).values({
    projectId: project.id,
    userId: currentUserId(),
    step: 3,
    targetType: 'segment',
    targetId: seg.id,
    feedback,
  });
  return c.json(serializeSegment(await generateSegment(project.id, seg, feedback)));
});
