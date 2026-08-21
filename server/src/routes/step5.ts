import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.ts';
import { aiFeedbackHistory, episodes, projects } from '../db/schema.ts';
import { getProject, projectIdOf, serializeEpisode } from '../lib/helpers.ts';
import { parseJson } from '../lib/validate.ts';
import { parseLabeled, splitList } from '../lib/parse.ts';
import { buildEpisodePrompt, buildFeedbackPrompt } from '../lib/prompt.ts';
import { generateText } from '../lib/ai.ts';
import { currentUserId } from '../lib/user.ts';
import { getEpisodeParentContext, getStoryBible, getPrevEpisodeSynopsis } from '../lib/context.ts';
import { startSSE } from '../lib/sse.ts';
import { startTask, waitIfPaused, abortTask, clearTask } from '../lib/genRegistry.ts';

const patchSchema = z.object({
  title: z.string().nullable().optional(),
  hook: z.string().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  key_scenes: z.array(z.string()).optional(),
});
const feedbackSchema = z.object({ feedback: z.string().min(1) });

export const step5Route = new Hono();

async function getEpisodeByNumber(projectId: string, epNum: number) {
  const rows = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.projectId, projectId), eq(episodes.episodeNumber, epNum)))
    .limit(1);
  if (rows.length === 0) throw new HTTPException(404, { message: '该集不存在' });
  return rows[0];
}

async function generateEpisode(projectId: string, ep: typeof episodes.$inferSelect, feedback?: string) {
  const [parent, bible, prevSynopsis] = await Promise.all([
    getEpisodeParentContext(projectId, ep.episodeNumber),
    getStoryBible(projectId),
    getPrevEpisodeSynopsis(projectId, ep.episodeNumber),
  ]);
  const basePrompt = buildEpisodePrompt(parent, ep.episodeNumber, bible, prevSynopsis);
  const current = [ep.title, ep.hook, ep.synopsis].filter(Boolean).join('\n');
  const prompt = feedback ? buildFeedbackPrompt(basePrompt, feedback, current) : basePrompt;
  const text = await generateText(prompt, { step: 'episode', ctx: { epNum: String(ep.episodeNumber) } });
  const parsed = parseLabeled(text);
  const [updated] = await db
    .update(episodes)
    .set({
      title: (parsed['标题'] ?? '').slice(0, 100),
      hook: parsed['开场钩子'] ?? '',
      synopsis: parsed['剧情简介'] ?? '',
      keyScenes: splitList(parsed['关键场次'] ?? ''),
      status: 'done',
    })
    .where(eq(episodes.id, ep.id))
    .returning();
  return updated;
}

step5Route.get('/episodes', async (c) => {
  const project = await getProject(projectIdOf(c));
  const rows = await db
    .select()
    .from(episodes)
    .where(eq(episodes.projectId, project.id))
    .orderBy(asc(episodes.episodeNumber));
  return c.json(rows.map(serializeEpisode));
});

step5Route.get('/episodes/:epNum', async (c) => {
  const project = await getProject(projectIdOf(c));
  const ep = await getEpisodeByNumber(project.id, Number(c.req.param('epNum')));
  return c.json(serializeEpisode(ep));
});

step5Route.post('/episodes/generate', async (c) => {
  const project = await getProject(projectIdOf(c));
  const rows = await db
    .select()
    .from(episodes)
    .where(eq(episodes.projectId, project.id))
    .orderBy(asc(episodes.episodeNumber));
  if (rows.length === 0) return c.json({ completed: 0, total: 0 });

  startTask(project.id, rows.length);
  return startSSE(
    c,
    async (send) => {
      await send('start', { step: 5, total: rows.length });
      let completed = 0;
      for (const ep of rows) {
        await waitIfPaused(project.id);
        const updated = await generateEpisode(project.id, ep);
        completed += 1;
        await send('done', { episode_number: updated.episodeNumber, ...serializeEpisode(updated) });
        await send('progress', { completed, total: rows.length });
      }
      await db
        .update(projects)
        .set({ currentStep: Math.max(project.currentStep, 5) })
        .where(eq(projects.id, project.id));
      clearTask(project.id);
      await send('finish', { completed, total: rows.length });
    },
    () => abortTask(project.id),
  );
});

step5Route.post('/episodes/:epNum/generate', async (c) => {
  const project = await getProject(projectIdOf(c));
  const ep = await getEpisodeByNumber(project.id, Number(c.req.param('epNum')));
  return c.json(serializeEpisode(await generateEpisode(project.id, ep)));
});

step5Route.patch('/episodes/:epNum', async (c) => {
  const project = await getProject(projectIdOf(c));
  const ep = await getEpisodeByNumber(project.id, Number(c.req.param('epNum')));
  const body = await parseJson(c, patchSchema);
  const [updated] = await db.update(episodes).set(body).where(eq(episodes.id, ep.id)).returning();
  return c.json(serializeEpisode(updated));
});

step5Route.post('/episodes/:epNum/feedback', async (c) => {
  const project = await getProject(projectIdOf(c));
  const ep = await getEpisodeByNumber(project.id, Number(c.req.param('epNum')));
  const { feedback } = await parseJson(c, feedbackSchema);
  await db.insert(aiFeedbackHistory).values({
    projectId: project.id,
    userId: currentUserId(),
    step: 5,
    targetType: 'episode',
    targetId: ep.id,
    feedback,
  });
  return c.json(serializeEpisode(await generateEpisode(project.id, ep, feedback)));
});
