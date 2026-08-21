import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.ts';
import { aiFeedbackHistory, episodes, projects, scripts } from '../db/schema.ts';
import { getProject, projectIdOf, serializeScript } from '../lib/helpers.ts';
import { parseJson } from '../lib/validate.ts';
import { countScriptStats } from '../lib/parse.ts';
import { buildScriptPrompt, buildFeedbackPrompt } from '../lib/prompt.ts';
import { generateText } from '../lib/ai.ts';
import { currentUserId } from '../lib/user.ts';
import { getStoryBible, getPrevEpisodeSynopsis } from '../lib/context.ts';
import { startSSE } from '../lib/sse.ts';
import { startTask, waitIfPaused, abortTask, clearTask, pauseTask, resumeTask } from '../lib/genRegistry.ts';

const patchSchema = z.object({ content: z.string() });
const feedbackSchema = z.object({ feedback: z.string().min(1) });

export const step6Route = new Hono();

async function getEpisodeByNumber(projectId: string, epNum: number) {
  const rows = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.projectId, projectId), eq(episodes.episodeNumber, epNum)))
    .limit(1);
  if (rows.length === 0) throw new HTTPException(404, { message: '该集不存在' });
  return rows[0];
}

async function getScriptByNumber(projectId: string, epNum: number) {
  const rows = await db
    .select()
    .from(scripts)
    .where(and(eq(scripts.projectId, projectId), eq(scripts.episodeNumber, epNum)))
    .limit(1);
  return rows[0] ?? null;
}

async function generateScript(projectId: string, ep: typeof episodes.$inferSelect, feedback?: string) {
  const project = await getProject(projectId);
  const existing = await getScriptByNumber(projectId, ep.episodeNumber);

  const [bible, prevSynopsis] = await Promise.all([
    getStoryBible(projectId),
    getPrevEpisodeSynopsis(projectId, ep.episodeNumber),
  ]);

  const basePrompt = buildScriptPrompt({
    market: project.market,
    scriptLanguage: project.scriptLanguage,
    dialogueLanguage: project.dialogueLanguage,
    durationMin: project.durationMin,
    episodes: project.episodes,
    epNum: ep.episodeNumber,
    episode: { title: ep.title, hook: ep.hook, synopsis: ep.synopsis },
    bible,
    prevSynopsis,
  });
  const current = existing?.content ?? '';
  const prompt = feedback ? buildFeedbackPrompt(basePrompt, feedback, current) : basePrompt;

  const content = await generateText(prompt, {
    step: 'script',
    ctx: { epNum: String(ep.episodeNumber) },
    maxTokens: 8000,
  });
  const stats = countScriptStats(content);

  let script: typeof scripts.$inferSelect;
  if (existing) {
    [script] = await db
      .update(scripts)
      .set({
        content,
        status: 'done',
        wordCount: stats.wordCount,
        sceneCount: stats.sceneCount,
        aiVersion: (existing.aiVersion ?? 0) + 1,
      })
      .where(eq(scripts.id, existing.id))
      .returning();
  } else {
    [script] = await db
      .insert(scripts)
      .values({
        projectId,
        episodeId: ep.id,
        episodeNumber: ep.episodeNumber,
        content,
        status: 'done',
        wordCount: stats.wordCount,
        sceneCount: stats.sceneCount,
      })
      .returning();
  }
  return script;
}

step6Route.get('/scripts', async (c) => {
  const project = await getProject(projectIdOf(c));
  const rows = await db
    .select()
    .from(scripts)
    .where(eq(scripts.projectId, project.id))
    .orderBy(asc(scripts.episodeNumber));
  return c.json(rows.map((s) => serializeScript(s, false)));
});

step6Route.get('/scripts/:epNum', async (c) => {
  const project = await getProject(projectIdOf(c));
  const epNum = Number(c.req.param('epNum'));
  const script = await getScriptByNumber(project.id, epNum);
  if (!script) {
    return c.json({ episode_number: epNum, status: 'pending', content: '', scene_count: 0, word_count: 0 });
  }
  return c.json(serializeScript(script, true));
});

step6Route.post('/scripts/generate/pause', async (c) => {
  const project = await getProject(projectIdOf(c));
  pauseTask(project.id);
  return c.json({ ok: true });
});

step6Route.post('/scripts/generate/resume', async (c) => {
  const project = await getProject(projectIdOf(c));
  resumeTask(project.id);
  return c.json({ ok: true });
});

step6Route.post('/scripts/generate', async (c) => {
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
      await send('start', { step: 6, total: rows.length });
      let completed = 0;
      for (const ep of rows) {
        await waitIfPaused(project.id);
        const script = await generateScript(project.id, ep);
        completed += 1;
        await send('done', { episode_number: script.episodeNumber, ...serializeScript(script, true) });
        await send('progress', { completed, total: rows.length });
      }
      await db
        .update(projects)
        .set({ currentStep: Math.max(project.currentStep, 6), status: 'completed' })
        .where(eq(projects.id, project.id));
      clearTask(project.id);
      await send('finish', { completed, total: rows.length });
    },
    () => abortTask(project.id),
  );
});

step6Route.post('/scripts/:epNum/generate', async (c) => {
  const project = await getProject(projectIdOf(c));
  const ep = await getEpisodeByNumber(project.id, Number(c.req.param('epNum')));
  const script = await generateScript(project.id, ep);
  return c.json(serializeScript(script, true));
});

step6Route.patch('/scripts/:epNum', async (c) => {
  const project = await getProject(projectIdOf(c));
  const epNum = Number(c.req.param('epNum'));
  const { content } = await parseJson(c, patchSchema);
  const existing = await getScriptByNumber(project.id, epNum);
  const stats = countScriptStats(content);

  let script: typeof scripts.$inferSelect;
  if (existing) {
    [script] = await db
      .update(scripts)
      .set({ content, status: 'done', wordCount: stats.wordCount, sceneCount: stats.sceneCount })
      .where(eq(scripts.id, existing.id))
      .returning();
  } else {
    const ep = await getEpisodeByNumber(project.id, epNum);
    [script] = await db
      .insert(scripts)
      .values({
        projectId: project.id,
        episodeId: ep.id,
        episodeNumber: epNum,
        content,
        status: 'done',
        wordCount: stats.wordCount,
        sceneCount: stats.sceneCount,
      })
      .returning();
  }
  return c.json(serializeScript(script, true));
});

step6Route.post('/scripts/:epNum/feedback', async (c) => {
  const project = await getProject(projectIdOf(c));
  const ep = await getEpisodeByNumber(project.id, Number(c.req.param('epNum')));
  const { feedback } = await parseJson(c, feedbackSchema);
  await db.insert(aiFeedbackHistory).values({
    projectId: project.id,
    userId: currentUserId(),
    step: 6,
    targetType: 'script',
    targetId: ep.id,
    feedback,
  });
  const script = await generateScript(project.id, ep, feedback);
  return c.json(serializeScript(script, true));
});
