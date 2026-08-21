import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.ts';
import { aiFeedbackHistory, episodeGroups, projects, segments } from '../db/schema.ts';
import { getProject, projectIdOf, serializeGroup, serializeSegment } from '../lib/helpers.ts';
import { parseJson } from '../lib/validate.ts';
import { parseLabeled } from '../lib/parse.ts';
import { buildGroupPrompt, buildDirectGroupPrompt, buildFeedbackPrompt } from '../lib/prompt.ts';
import { generateText } from '../lib/ai.ts';
import { currentUserId } from '../lib/user.ts';
import { getStep2Result, getCharactersForPrompt } from '../lib/context.ts';
import { getDirectGroupSize, rangeLabel } from '../lib/segments.ts';
import { startSSE } from '../lib/sse.ts';
import { startTask, waitIfPaused, abortTask, clearTask } from '../lib/genRegistry.ts';

const patchSchema = z.object({
  label: z.string().nullable().optional(),
  hook: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  ending_hook: z.string().nullable().optional(),
});
const feedbackSchema = z.object({ feedback: z.string().min(1) });

export const step4Route = new Hono();

async function getGroup(projectId: string, groupId: string) {
  const rows = await db
    .select()
    .from(episodeGroups)
    .where(and(eq(episodeGroups.id, groupId), eq(episodeGroups.projectId, projectId)))
    .limit(1);
  if (rows.length === 0) throw new HTTPException(404, { message: '小段不存在' });
  return rows[0];
}

function groupCtx(group: typeof episodeGroups.$inferSelect) {
  return { range: `第 ${group.episodeStart}–${group.episodeEnd} 集` };
}

/** 解析 AI 输出并落库，返回更新后的小段。 */
async function finalizeGroup(group: typeof episodeGroups.$inferSelect, text: string) {
  const parsed = parseLabeled(text);
  const [updated] = await db
    .update(episodeGroups)
    .set({
      label: group.label ?? `第${group.sortOrder}小段`,
      hook: parsed['开场钩子'] ?? '',
      summary: parsed['剧情简介'] ?? '',
      endingHook: parsed['结尾钩子'] ?? '',
      status: 'done',
    })
    .where(eq(episodeGroups.id, group.id))
    .returning();
  return updated;
}

async function generateGroup(
  projectId: string,
  seg: typeof segments.$inferSelect,
  group: typeof episodeGroups.$inferSelect,
  feedback?: string,
) {
  const basePrompt = buildGroupPrompt(
    {
      range: { start: seg.episodeStart, end: seg.episodeEnd },
      hook: seg.hook ?? '',
      summary: seg.summary ?? '',
      endingHook: seg.endingHook ?? '',
    },
    { start: group.episodeStart, end: group.episodeEnd },
  );
  const current = [group.hook, group.summary, group.endingHook].filter(Boolean).join('\n');
  const prompt = feedback ? buildFeedbackPrompt(basePrompt, feedback, current) : basePrompt;
  const text = await generateText(prompt, { step: 'group', ctx: groupCtx(group) });
  return finalizeGroup(group, text);
}

/** ≤40 集：跳过第三步，直接以 step2 故事线为上下文生成小段。 */
async function generateDirectGroup(
  project: typeof projects.$inferSelect,
  group: typeof episodeGroups.$inferSelect,
  feedback?: string,
) {
  const [characters, step2] = await Promise.all([
    getCharactersForPrompt(project.id),
    getStep2Result(project.id),
  ]);
  const basePrompt = buildDirectGroupPrompt({
    market: project.market,
    episodes: project.episodes,
    durationMin: project.durationMin,
    characters,
    background: step2?.background ?? '',
    storyline: step2?.storyline ?? '',
    range: { start: group.episodeStart, end: group.episodeEnd },
    size: getDirectGroupSize(project.episodes),
  });
  const current = [group.hook, group.summary, group.endingHook].filter(Boolean).join('\n');
  const prompt = feedback ? buildFeedbackPrompt(basePrompt, feedback, current) : basePrompt;
  const text = await generateText(prompt, { step: 'group', ctx: groupCtx(group) });
  return finalizeGroup(group, text);
}

step4Route.get('/episode-groups', async (c) => {
  const project = await getProject(projectIdOf(c));
  const [segs, groups] = await Promise.all([
    db.select().from(segments).where(eq(segments.projectId, project.id)).orderBy(asc(segments.sortOrder)),
    db.select().from(episodeGroups).where(eq(episodeGroups.projectId, project.id)).orderBy(asc(episodeGroups.sortOrder)),
  ]);
  const bySegment = new Map<string, typeof groups>();
  const direct: typeof groups = [];
  for (const g of groups) {
    if (g.segmentId === null) {
      direct.push(g);
      continue;
    }
    const arr = bySegment.get(g.segmentId) ?? [];
    arr.push(g);
    bySegment.set(g.segmentId, arr);
  }

  const result: Record<string, unknown>[] = segs.map((s) => ({
    ...serializeSegment(s),
    groups: (bySegment.get(s.id) ?? []).map(serializeGroup),
  }));

  // ≤40 集无分段，合成一个容器段以适配前端的「分段 → 小段」结构。
  if (direct.length > 0) {
    result.unshift({
      id: 'direct',
      sort_order: 0,
      title: '分集粗纲',
      episode_start: 1,
      episode_end: project.episodes,
      range: rangeLabel({ start: 1, end: project.episodes }),
      hook: null,
      summary: null,
      ending_hook: null,
      status: 'done',
      groups: direct.map(serializeGroup),
    });
  }

  return c.json(result);
});

step4Route.post('/episode-groups/generate', async (c) => {
  const project = await getProject(projectIdOf(c));
  const [segs, groups] = await Promise.all([
    db.select().from(segments).where(eq(segments.projectId, project.id)).orderBy(asc(segments.sortOrder)),
    db.select().from(episodeGroups).where(eq(episodeGroups.projectId, project.id)).orderBy(asc(episodeGroups.sortOrder)),
  ]);
  if (groups.length === 0) return c.json({ completed: 0, total: 0 });

  const total = groups.length;
  const segById = new Map(segs.map((s) => [s.id, s]));
  const ordered = [...groups].sort((a, b) => a.episodeStart - b.episodeStart);

  startTask(project.id, total);
  return startSSE(
    c,
    async (send) => {
      await send('start', { step: 4, total });
      let completed = 0;
      for (const group of ordered) {
        await waitIfPaused(project.id);
        const seg = group.segmentId ? (segById.get(group.segmentId) ?? null) : null;
        const updated = seg
          ? await generateGroup(project.id, seg, group)
          : await generateDirectGroup(project, group);
        completed += 1;
        await send('done', {
          group_id: updated.id,
          segment_id: seg?.id ?? null,
          ...serializeGroup(updated),
        });
        await send('progress', { completed, total });
      }
      await db
        .update(projects)
        .set({ currentStep: Math.max(project.currentStep, 4) })
        .where(eq(projects.id, project.id));
      clearTask(project.id);
      await send('finish', { completed, total });
    },
    () => abortTask(project.id),
  );
});

step4Route.post('/episode-groups/:groupId/generate', async (c) => {
  const project = await getProject(projectIdOf(c));
  const group = await getGroup(project.id, c.req.param('groupId'));
  if (group.segmentId === null) {
    return c.json(serializeGroup(await generateDirectGroup(project, group)));
  }
  const seg = (await db.select().from(segments).where(eq(segments.id, group.segmentId)).limit(1))[0];
  return c.json(serializeGroup(await generateGroup(project.id, seg, group)));
});

step4Route.patch('/episode-groups/:groupId', async (c) => {
  const project = await getProject(projectIdOf(c));
  const group = await getGroup(project.id, c.req.param('groupId'));
  const body = await parseJson(c, patchSchema);
  const [updated] = await db.update(episodeGroups).set(body).where(eq(episodeGroups.id, group.id)).returning();
  return c.json(serializeGroup(updated));
});

step4Route.post('/episode-groups/:groupId/feedback', async (c) => {
  const project = await getProject(projectIdOf(c));
  const group = await getGroup(project.id, c.req.param('groupId'));
  const { feedback } = await parseJson(c, feedbackSchema);
  await db.insert(aiFeedbackHistory).values({
    projectId: project.id,
    userId: currentUserId(),
    step: 4,
    targetType: 'episode_group',
    targetId: group.id,
    feedback,
  });
  const updated =
    group.segmentId === null
      ? await generateDirectGroup(project, group, feedback)
      : await generateGroup(
          project.id,
          (await db.select().from(segments).where(eq(segments.id, group.segmentId)).limit(1))[0],
          group,
          feedback,
        );
  return c.json(serializeGroup(updated));
});
