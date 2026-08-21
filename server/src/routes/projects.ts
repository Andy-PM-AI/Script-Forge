import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, count } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { projects, characters, segments, episodeGroups, episodes, scripts } from '../db/schema.ts';
import { currentUserId } from '../lib/user.ts';
import { getProject, serializeProject, serializeCharacter } from '../lib/helpers.ts';
import { parseJson } from '../lib/validate.ts';
import { computeSegmentRanges, computeGroupRanges, computeDirectGroupRanges } from '../lib/segments.ts';

const createProjectSchema = z.object({
  name: z.string().trim().min(1, '剧名不能为空').max(50, '剧名不超过50字'),
  market: z.enum(['china', 'global', 'latam']),
  genres: z.array(z.string()).default([]),
  episodes: z.number().int().min(20).max(100),
  duration_min: z.number().int().min(1).default(80),
  script_language: z.enum(['zh', 'en']).default('zh'),
  dialogue_language: z.enum(['zh', 'en-zh', 'en']).default('zh'),
  synopsis: z.string().nullable().optional(),
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        gender: z.enum(['male', 'female', 'other']).default('other'),
        is_protagonist: z.boolean().default(false),
        description: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1, '剧名不能为空').max(50, '剧名不超过50字').optional(),
  market: z.enum(['china', 'global', 'latam']).optional(),
  genres: z.array(z.string()).optional(),
  episodes: z.number().int().min(20).max(100).optional(),
  duration_min: z.number().int().min(1).optional(),
  script_language: z.enum(['zh', 'en']).optional(),
  dialogue_language: z.enum(['zh', 'en-zh', 'en']).optional(),
  synopsis: z.string().nullable().optional(),
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        gender: z.enum(['male', 'female', 'other']).default('other'),
        is_protagonist: z.boolean().default(false),
        description: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export const projectsRoute = new Hono();

projectsRoute.get('/', async (c) => {
  const q = c.req.query();
  const search = q.search?.trim() ?? '';
  const market = q.market ?? '';
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(50, Number(q.limit) || 50);
  const sort = q.sort ?? 'updated_at';
  const order = q.order ?? 'desc';

  const where = [eq(projects.userId, currentUserId())];
  if (search) where.push(ilike(projects.name, `%${search}%`));
  if (market) where.push(eq(projects.market, market));

  const orderCol = sort === 'name' ? projects.name : sort === 'created_at' ? projects.createdAt : projects.updatedAt;
  const orderBy = order === 'asc' ? asc(orderCol) : desc(orderCol);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(and(...where))
      .orderBy(orderBy)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ n: count() }).from(projects).where(and(...where)),
  ]);

  return c.json({
    items: rows.map(serializeProject),
    total: totalRows[0]?.n ?? 0,
    page,
    limit,
  });
});

projectsRoute.post('/', async (c) => {
  const body = await parseJson(c, createProjectSchema);
  const uid = currentUserId();
  const colorSeed = Math.floor(Math.random() * 6);

  const created = await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        userId: uid,
        name: body.name,
        market: body.market,
        genres: body.genres,
        episodes: body.episodes,
        durationMin: body.duration_min,
        scriptLanguage: body.script_language,
        dialogueLanguage: body.dialogue_language,
        synopsis: body.synopsis ?? null,
        colorSeed,
        currentStep: 1,
        status: 'draft',
      })
      .returning();

    // 人物小传（user_input）
    if (body.characters.length > 0) {
      await tx.insert(characters).values(
        body.characters.map((ch, i) => ({
          projectId: project.id,
          source: 'user_input',
          name: ch.name,
          gender: ch.gender,
          isProtagonist: ch.is_protagonist,
          description: ch.description ?? null,
          sortOrder: i,
        })),
      );
    }

    // 分段占位
    const segRanges = computeSegmentRanges(body.episodes);
    const insertedSegments = segRanges.length
      ? await tx
          .insert(segments)
          .values(
            segRanges.map((r, i) => ({
              projectId: project.id,
              sortOrder: i + 1,
              title: `第${i + 1}段`,
              episodeStart: r.start,
              episodeEnd: r.end,
              status: 'pending',
            })),
          )
          .returning({ id: segments.id, episodeStart: segments.episodeStart, episodeEnd: segments.episodeEnd })
      : [];

    // 分集粗纲占位：>40 集挂在分段下；≤40 集直接分小段（segmentId 为空）。
    if (body.episodes > 40 && insertedSegments.length > 0) {
      const groupValues: (typeof episodeGroups.$inferInsert)[] = [];
      for (const seg of insertedSegments) {
        const groups = computeGroupRanges({ start: seg.episodeStart, end: seg.episodeEnd });
        groups.forEach((r, j) => {
          groupValues.push({
            projectId: project.id,
            segmentId: seg.id,
            sortOrder: j + 1,
            label: `第${j + 1}小段`,
            episodeStart: r.start,
            episodeEnd: r.end,
            status: 'pending',
          });
        });
      }
      if (groupValues.length > 0) await tx.insert(episodeGroups).values(groupValues);
    } else {
      const directRanges = computeDirectGroupRanges(body.episodes);
      if (directRanges.length > 0) {
        await tx.insert(episodeGroups).values(
          directRanges.map((r, i) => ({
            projectId: project.id,
            segmentId: null,
            sortOrder: i + 1,
            label: `第${i + 1}小段`,
            episodeStart: r.start,
            episodeEnd: r.end,
            status: 'pending',
          })),
        );
      }
    }

    // 分集大纲占位
    await tx.insert(episodes).values(
      Array.from({ length: body.episodes }, (_, i) => ({
        projectId: project.id,
        episodeNumber: i + 1,
        status: 'pending',
      })),
    );

    return project;
  });

  return c.json(serializeProject(created), 201);
});

projectsRoute.get('/:id', async (c) => {
  const p = await getProject(c.req.param('id'));

  const [scriptStats, characterRows] = await Promise.all([
    db
      .select({
        words: scripts.wordCount,
        scenes: scripts.sceneCount,
      })
      .from(scripts)
      .where(eq(scripts.projectId, p.id)),
    db.select().from(characters).where(eq(characters.projectId, p.id)).orderBy(asc(characters.sortOrder)),
  ]);

  const totalWords = scriptStats.reduce((sum, s) => sum + (s.words ?? 0), 0);
  const totalScenes = scriptStats.reduce((sum, s) => sum + (s.scenes ?? 0), 0);

  return c.json({
    ...serializeProject(p),
    characters: characterRows.map(serializeCharacter),
    stats: {
      total_episodes: p.episodes,
      total_scenes: totalScenes,
      total_words: totalWords,
      total_duration: p.durationMin,
    },
  });
});

projectsRoute.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const project = await getProject(id);
  const body = await parseJson(c, updateProjectSchema);

  const { characters: characterInput, ...scalar } = body;
  const episodesChanged = body.episodes !== undefined && body.episodes !== project.episodes;

  const updated = await db.transaction(async (tx) => {
    // 标量字段（name/market/genres/episodes/duration/languages/synopsis）。
    // 集数变化会作废下游占位数据，同时把进度重置回第一步。
    const setValues: Record<string, unknown> = { ...scalar };
    if (episodesChanged) setValues.currentStep = 1;
    let row = project;
    if (Object.keys(setValues).length > 0) {
      [row] = await tx.update(projects).set(setValues).where(eq(projects.id, id)).returning();
    }

    // 人物小传（user_input）：整体替换。
    if (characterInput !== undefined) {
      await tx
        .delete(characters)
        .where(and(eq(characters.projectId, id), eq(characters.source, 'user_input')));
      if (characterInput.length > 0) {
        await tx.insert(characters).values(
          characterInput.map((ch, i) => ({
            projectId: id,
            source: 'user_input',
            name: ch.name,
            gender: ch.gender,
            isProtagonist: ch.is_protagonist,
            description: ch.description ?? null,
            sortOrder: i,
          })),
        );
      }
    }

    // 集数变化：重建分段/分集/分集大纲占位，并清空已生成的分镜脚本。
    if (episodesChanged && body.episodes !== undefined) {
      const episodesCount = body.episodes;
      await tx.delete(episodeGroups).where(eq(episodeGroups.projectId, id)); // 直接分小段不随 segments 级联，需显式删除
      await tx.delete(segments).where(eq(segments.projectId, id)); // 级联删除残余 episode_groups
      await tx.delete(episodes).where(eq(episodes.projectId, id));
      await tx.delete(scripts).where(eq(scripts.projectId, id));

      const segRanges = computeSegmentRanges(episodesCount);
      const insertedSegments = segRanges.length
        ? await tx
            .insert(segments)
            .values(
              segRanges.map((r, i) => ({
                projectId: id,
                sortOrder: i + 1,
                title: `第${i + 1}段`,
                episodeStart: r.start,
                episodeEnd: r.end,
                status: 'pending',
              })),
            )
            .returning({ id: segments.id, episodeStart: segments.episodeStart, episodeEnd: segments.episodeEnd })
        : [];

      if (episodesCount > 40 && insertedSegments.length > 0) {
        const groupValues: (typeof episodeGroups.$inferInsert)[] = [];
        for (const seg of insertedSegments) {
          const groups = computeGroupRanges({ start: seg.episodeStart, end: seg.episodeEnd });
          groups.forEach((r, j) => {
            groupValues.push({
              projectId: id,
              segmentId: seg.id,
              sortOrder: j + 1,
              label: `第${j + 1}小段`,
              episodeStart: r.start,
              episodeEnd: r.end,
              status: 'pending',
            });
          });
        }
        if (groupValues.length > 0) await tx.insert(episodeGroups).values(groupValues);
      } else {
        const directRanges = computeDirectGroupRanges(episodesCount);
        if (directRanges.length > 0) {
          await tx.insert(episodeGroups).values(
            directRanges.map((r, i) => ({
              projectId: id,
              segmentId: null,
              sortOrder: i + 1,
              label: `第${i + 1}小段`,
              episodeStart: r.start,
              episodeEnd: r.end,
              status: 'pending',
            })),
          );
        }
      }

      await tx.insert(episodes).values(
        Array.from({ length: episodesCount }, (_, i) => ({
          projectId: id,
          episodeNumber: i + 1,
          status: 'pending',
        })),
      );
    }

    return row;
  });

  return c.json(serializeProject(updated));
});

projectsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await getProject(id);
  await db.delete(projects).where(eq(projects.id, id));
  return c.json({ ok: true });
});
