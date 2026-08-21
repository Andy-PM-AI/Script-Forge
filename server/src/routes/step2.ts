import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.ts';
import { aiFeedbackHistory, characters, projects, step2Results } from '../db/schema.ts';
import { getProject, projectIdOf, serializeCharacter } from '../lib/helpers.ts';
import { parseJson } from '../lib/validate.ts';
import { parseSections, parseCharacters, parseNameRecommendations, escapeRegExp } from '../lib/parse.ts';
import { buildStep2Prompt, buildFeedbackPrompt, buildNameRecommendPrompt } from '../lib/prompt.ts';
import { generateText } from '../lib/ai.ts';
import { currentUserId } from '../lib/user.ts';
import { getStep2Result } from '../lib/context.ts';

const generateSchema = z.object({
  target: z.enum(['all', 'characters', 'background', 'storyline']).default('all'),
});
const feedbackSchema = z.object({
  target: z.enum(['characters', 'background', 'storyline']),
  target_id: z.string().uuid().nullable().optional(),
  feedback: z.string().min(1),
});
const characterPatchSchema = z.object({
  name: z.string().min(1).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  age: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  is_protagonist: z.boolean().optional(),
  traits: z.array(z.string()).optional(),
  description: z.string().nullable().optional(),
  backstory: z.string().nullable().optional(),
});
const textPatchSchema = z.object({ content: z.string() });
const nameRecommendSchema = z.object({ current_name: z.string().optional() });
const replaceNameSchema = z.object({
  character_id: z.string().uuid(),
  old_name: z.string().min(1),
  new_name: z.string().min(1),
});

export const step2Route = new Hono();

async function upsertStep2(projectId: string, patch: { background?: string; storyline?: string }) {
  const existing = await getStep2Result(projectId);
  if (existing) {
    await db.update(step2Results).set(patch).where(eq(step2Results.projectId, projectId));
  } else {
    await db
      .insert(step2Results)
      .values({ projectId, background: patch.background ?? '', storyline: patch.storyline ?? '' });
  }
}

/** 读取 step2 完整数据（人物 + background + storyline）。 */
async function getStep2Payload(projectId: string) {
  const [charRows, step2] = await Promise.all([
    db.select().from(characters).where(eq(characters.projectId, projectId)).orderBy(asc(characters.sortOrder)),
    getStep2Result(projectId),
  ]);
  return {
    characters: charRows.map(serializeCharacter),
    background: step2?.background ?? '',
    storyline: step2?.storyline ?? '',
  };
}

async function currentContentFor(projectId: string, target: string): Promise<string> {
  if (target === 'background' || target === 'storyline') {
    const step2 = await getStep2Result(projectId);
    return (target === 'background' ? step2?.background : step2?.storyline) ?? '';
  }
  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.projectId, projectId), eq(characters.source, 'ai_generated')))
    .orderBy(asc(characters.sortOrder));
  if (rows.length === 0) return '';
  return rows
    .map(
      (c) =>
        `姓名：${c.name}\n年龄：${c.age ?? ''}\n身份：${c.role ?? ''}\n性别：${c.gender ?? ''}\n性格特点：${(c.traits ?? []).join('、')}\n经历介绍：${c.backstory ?? ''}`,
    )
    .join('\n\n');
}

/** 触发一次 step2 生成（人物/背景/故事线三者一次生成，按 target 应用）。 */
async function runStep2Generate(projectId: string, target: string, feedback?: { feedback: string; current: string }) {
  const project = await getProject(projectId);
  const userChars = await db
    .select()
    .from(characters)
    .where(and(eq(characters.projectId, projectId), eq(characters.source, 'user_input')))
    .orderBy(asc(characters.sortOrder));

  const basePrompt = buildStep2Prompt({
    market: project.market,
    genres: project.genres ?? [],
    episodes: project.episodes,
    durationMin: project.durationMin,
    scriptLanguage: project.scriptLanguage,
    dialogueLanguage: project.dialogueLanguage,
    synopsis: project.synopsis,
    characters: userChars.map((c) => ({
      name: c.name,
      gender: c.gender ?? 'other',
      isProtagonist: c.isProtagonist ?? false,
      description: c.description,
    })),
  });

  const prompt = feedback ? buildFeedbackPrompt(basePrompt, feedback.feedback, feedback.current) : basePrompt;
  const text = await generateText(prompt, { step: 'step2' });
  const sections = parseSections(text);
  const parsedChars = parseCharacters(sections.characters);
  const existing = await getStep2Result(projectId);

  const applyCharacters = target === 'all' || target === 'characters';
  const applyBackground = target === 'all' || target === 'background';
  const applyStoryline = target === 'all' || target === 'storyline';

  if (applyCharacters) {
    await db
      .delete(characters)
      .where(and(eq(characters.projectId, projectId), eq(characters.source, 'ai_generated')));
    if (parsedChars.length > 0) {
      await db.insert(characters).values(
        parsedChars.map((c, i) => ({
          projectId,
          source: 'ai_generated',
          name: c.name,
          gender: c.gender,
          age: c.age,
          role: c.role,
          isProtagonist: /主角/.test(c.role),
          traits: c.traits,
          description: null,
          backstory: c.backstory,
          sortOrder: i,
        })),
      );
    }
  }

  const background = applyBackground ? sections.background : existing?.background ?? '';
  const storyline = applyStoryline ? sections.storyline : existing?.storyline ?? '';
  await upsertStep2(projectId, { background, storyline });

  await db
    .update(projects)
    .set({ currentStep: Math.max(project.currentStep, 2) })
    .where(eq(projects.id, projectId));

  return getStep2Payload(projectId);
}

step2Route.get('/step2', async (c) => {
  const project = await getProject(projectIdOf(c));
  return c.json(await getStep2Payload(project.id));
});

step2Route.post('/step2/generate', async (c) => {
  const project = await getProject(projectIdOf(c));
  const body = await parseJson(c, generateSchema);
  return c.json(await runStep2Generate(project.id, body.target));
});

step2Route.post('/step2/feedback', async (c) => {
  const project = await getProject(projectIdOf(c));
  const body = await parseJson(c, feedbackSchema);
  const current = await currentContentFor(project.id, body.target);
  await db.insert(aiFeedbackHistory).values({
    projectId: project.id,
    userId: currentUserId(),
    step: 2,
    targetType: body.target,
    targetId: body.target_id ?? null,
    feedback: body.feedback,
  });
  return c.json(await runStep2Generate(project.id, body.target, { feedback: body.feedback, current }));
});

step2Route.patch('/characters/:charId', async (c) => {
  const project = await getProject(projectIdOf(c));
  const charId = c.req.param('charId');
  const body = await parseJson(c, characterPatchSchema);
  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, charId), eq(characters.projectId, project.id)))
    .limit(1);
  if (rows.length === 0) throw new HTTPException(404, { message: '角色不存在' });
  const [updated] = await db.update(characters).set(body).where(eq(characters.id, charId)).returning();
  return c.json(serializeCharacter(updated));
});

step2Route.patch('/step2/background', async (c) => {
  const project = await getProject(projectIdOf(c));
  const { content } = await parseJson(c, textPatchSchema);
  await upsertStep2(project.id, { background: content });
  return c.json({ background: content });
});

step2Route.patch('/step2/storyline', async (c) => {
  const project = await getProject(projectIdOf(c));
  const { content } = await parseJson(c, textPatchSchema);
  await upsertStep2(project.id, { storyline: content });
  return c.json({ storyline: content });
});

step2Route.post('/characters/:charId/name-recommendations', async (c) => {
  const project = await getProject(projectIdOf(c));
  const charId = c.req.param('charId');
  const body = await parseJson(c, nameRecommendSchema);

  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, charId), eq(characters.projectId, project.id)))
    .limit(1);
  if (rows.length === 0) throw new HTTPException(404, { message: '角色不存在' });

  const currentName = (body.current_name ?? '').trim() || rows[0].name;
  const text = await generateText(buildNameRecommendPrompt(currentName), { step: 'name-recommend', maxTokens: 800 });
  return c.json({ recommendations: parseNameRecommendations(text) });
});

step2Route.post('/step2/replace-name', async (c) => {
  const project = await getProject(projectIdOf(c));
  const { character_id, old_name, new_name } = await parseJson(c, replaceNameSchema);
  const re = new RegExp(escapeRegExp(old_name), 'g');

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(characters).where(eq(characters.projectId, project.id));
    for (const row of rows) {
      const isTarget = row.id === character_id;
      await tx
        .update(characters)
        .set({
          name: isTarget ? new_name : row.name,
          backstory: row.backstory ? row.backstory.replace(re, new_name) : row.backstory,
          description: row.description ? row.description.replace(re, new_name) : row.description,
        })
        .where(eq(characters.id, row.id));
    }

    const step2 = await tx.select().from(step2Results).where(eq(step2Results.projectId, project.id)).limit(1);
    if (step2.length > 0) {
      await tx
        .update(step2Results)
        .set({
          background: (step2[0].background ?? '').replace(re, new_name),
          storyline: (step2[0].storyline ?? '').replace(re, new_name),
        })
        .where(eq(step2Results.projectId, project.id));
    }
  });

  return c.json(await getStep2Payload(project.id));
});
