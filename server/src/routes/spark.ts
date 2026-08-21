import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.ts';
import {
  sparkSessions,
  sparkDrafts,
  sparkDedupLedger,
  kbElements,
  projects,
  characters,
  segments,
  episodeGroups,
  episodes,
} from '../db/schema.ts';
import { currentUserId } from '../lib/user.ts';
import { parseJson } from '../lib/validate.ts';
import { startSSE } from '../lib/sse.ts';
import { generateText, isRealAi } from '../lib/ai.ts';
import { computeSegmentRanges, computeGroupRanges, computeDirectGroupRanges } from '../lib/segments.ts';
import {
  gradeThreshold,
  dedupCycleDays,
  getUsedAxes,
  pickArchetype,
  pickSpine,
  searchKb,
  buildSparkPrompt,
  parseSparkDraft,
  computeNovelty,
  computeSimilarity,
  mockSparkDraft,
  type ParsedSparkDraft,
} from '../lib/spark.ts';

const generateSchema = z.object({
  market: z.enum(['global', 'latam', 'china']),
  genres: z.array(z.string()).default([]),
  episodes: z.number().int().min(20).max(100),
  duration: z.number().int().min(1).default(80),
  script_language: z.enum(['zh', 'en']).default('en'),
  dialogue_language: z.enum(['zh', 'en-zh', 'en']).default('en'),
  dedup_cycle: z.enum(['session', '7d', '30d', '90d', '180d', 'all']).default('90d'),
  novelty_ratio: z.number().int().min(40).max(100).default(60),
  element_grade: z.enum(['S', 'SA', 'SAB']).default('SA'),
  diff_strength: z.enum(['high', 'medium', 'low']).default('high'),
  session_id: z.string().uuid().optional(),
  directions: z.array(z.string()).default([]),
  custom_direction: z.string().default(''),
});

const adoptSchema = z.object({
  draft_id: z.string().uuid(),
  session_id: z.string().uuid(),
  project_name: z.string().trim().min(1).max(50),
});

const rejectSchema = z.object({
  draft_id: z.string().uuid(),
  session_id: z.string().uuid(),
  reject_count: z.number().int().default(0),
  directions: z.array(z.string()).default([]),
  custom_direction: z.string().default(''),
});

export const sparkRoute = new Hono();

async function findSession(id: string, uid: string): Promise<typeof sparkSessions.$inferSelect> {
  const rows = await db
    .select()
    .from(sparkSessions)
    .where(and(eq(sparkSessions.id, id), eq(sparkSessions.userId, uid)))
    .limit(1);
  if (rows.length === 0) throw new HTTPException(404, { message: '会话不存在' });
  return rows[0];
}

function inferGender(role: string): 'male' | 'female' | 'other' {
  if (/女/.test(role)) return 'female';
  if (/男/.test(role)) return 'male';
  return 'other';
}

const NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

function toDraftPayload(row: typeof sparkDrafts.$inferSelect): Record<string, unknown> {
  const emotion = (row.emotion ?? {}) as { primary?: string; secondary?: string[]; aux?: string[]; rhythm?: string };
  const axes = (row.diffAxes ?? {}) as { archetype?: string; spine?: string };
  const chars = (row.characters ?? []) as Record<string, unknown>[];
  const mems = (row.memories ?? []) as Record<string, unknown>[];
  const risks = (row.risks ?? []) as Record<string, unknown>[];

  return {
    draft_id: row.id,
    session_id: row.sessionId,
    draft_index: row.draftIndex,
    status: row.status,
    high_concept: row.highConcept ?? '',
    high_concept_source: row.highConceptSource ?? '',
    characters: chars.map((ch, i) => ({
      name: ch['name'] ?? '',
      role: ch['role'] ?? '',
      archetype: ch['archetype'] ?? '',
      description: ch['description'] ?? '',
      color_seed: i,
    })),
    emotion_primary: emotion.primary ?? '',
    emotion_secondary: emotion.secondary ?? [],
    emotion_aux: emotion.aux ?? [],
    emotion_rhythm: emotion.rhythm ?? '',
    memories: mems.map((m, i) => ({
      num: NUMS[i % NUMS.length],
      title: m['title'] ?? '',
      desc: m['desc'] ?? '',
      episode: m['episode'] ?? '',
    })),
    risks: risks.map((r) => ({
      level: r['level'] ?? 'medium',
      desc: r['desc'] ?? '',
      mitigation: r['mitigation'] ?? '',
    })),
    novelty_score: row.noveltyScore,
    similarity_score: row.similarityScore,
    archetype: axes.archetype ?? '',
    spine: axes.spine ?? '',
    diff_validation: (row.noveltyScore ?? 0) >= 60 && (row.similarityScore ?? 0) < 0.85,
  };
}

/* GET /api/spark/history?session_id= */
sparkRoute.get('/history', async (c) => {
  const sessionId = c.req.query('session_id');
  if (!sessionId) return c.json({ items: [] });
  const rows = await db
    .select()
    .from(sparkDrafts)
    .where(eq(sparkDrafts.sessionId, sessionId))
    .orderBy(asc(sparkDrafts.draftIndex));
  return c.json({ items: rows.map(toDraftPayload) });
});

/* GET /api/spark/kb/capacity?market=&genres=&grade= */
sparkRoute.get('/kb/capacity', async (c) => {
  const q = c.req.query();
  const genres = (q.genres ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const grades = gradeThreshold(q.grade ?? 'SA');

  const allArchetypes = await db
    .select({ genreTags: kbElements.genreTags, sourceWork: kbElements.sourceWork, grade: kbElements.grade })
    .from(kbElements)
    .where(eq(kbElements.type, 'archetype'));

  const gs = new Set(genres.map((g) => g.toLowerCase()));
  const matched = allArchetypes.filter(
    (r) =>
      grades.includes(r.grade) &&
      (genres.length === 0 || (r.genreTags ?? []).some((t) => gs.has(t.toLowerCase()))),
  );

  const archetypeCount = matched.length;
  const novelCount = new Set(matched.map((r) => r.sourceWork).filter(Boolean)).size;
  const estimatedDiffSlots = genres.length === 0 ? 1 : Math.max(1, Math.min(10, Math.floor(archetypeCount / 30)));
  const capacityLevel = archetypeCount >= 60 ? 'ok' : archetypeCount >= 20 ? 'warn' : 'danger';

  return c.json({
    novel_count: novelCount,
    archetype_count: archetypeCount,
    estimated_diff_slots: estimatedDiffSlots,
    capacity_level: capacityLevel,
  });
});

/* POST /api/spark/reject */
sparkRoute.post('/reject', async (c) => {
  const body = await parseJson(c, rejectSchema);
  const uid = currentUserId();
  const session = await findSession(body.session_id, uid);

  const [draft] = await db
    .select()
    .from(sparkDrafts)
    .where(and(eq(sparkDrafts.id, body.draft_id), eq(sparkDrafts.sessionId, session.id)))
    .limit(1);
  if (!draft) throw new HTTPException(404, { message: '初稿不存在' });

  const reasons = [...body.directions, body.custom_direction].filter(Boolean);
  await db
    .update(sparkDrafts)
    .set({ status: 'rejected', rejectReasons: reasons })
    .where(eq(sparkDrafts.id, draft.id));

  return c.json({ ok: true });
});

/* POST /api/spark/adopt */
sparkRoute.post('/adopt', async (c) => {
  const body = await parseJson(c, adoptSchema);
  const uid = currentUserId();
  const session = await findSession(body.session_id, uid);

  const [draft] = await db
    .select()
    .from(sparkDrafts)
    .where(and(eq(sparkDrafts.id, body.draft_id), eq(sparkDrafts.sessionId, session.id)))
    .limit(1);
  if (!draft) throw new HTTPException(404, { message: '初稿不存在' });

  const axes = (draft.diffAxes ?? {}) as { archetype?: string; spine?: string };
  const chars = ((draft.characters ?? []) as Record<string, unknown>[])
    .map((ch) => ({
      name: (ch['name'] as string) ?? '',
      gender: inferGender((ch['role'] as string) ?? ''),
      isProtagonist: false,
      description: (ch['description'] as string | null) ?? null,
    }))
    .filter((c) => c.name.length > 0)
    .map((c, i) => ({ ...c, isProtagonist: i < 2 }));

  const colorSeed = Math.floor(Math.random() * 6);

  const project = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(projects)
      .values({
        userId: uid,
        name: body.project_name,
        market: session.market,
        genres: session.genres,
        episodes: session.episodes,
        durationMin: session.duration,
        scriptLanguage: session.scriptLang,
        dialogueLanguage: session.dialogueLang,
        synopsis: draft.highConcept ?? null,
        colorSeed,
        currentStep: 1, // 采纳后进入第一步，用户可在项目设定中复核/编辑自动填充的数据
        status: 'draft',
      })
      .returning();

    if (chars.length > 0) {
      await tx.insert(characters).values(
        chars.map((ch, i) => ({
          projectId: p.id,
          source: 'user_input',
          name: ch.name,
          gender: ch.gender,
          isProtagonist: ch.isProtagonist,
          description: ch.description,
          sortOrder: i,
        })),
      );
    }

    // 分段 / 分集 / 分集大纲占位（与 POST /projects 一致）
    const segRanges = computeSegmentRanges(session.episodes);
    const insertedSegments = segRanges.length
      ? await tx
          .insert(segments)
          .values(
            segRanges.map((r, i) => ({
              projectId: p.id,
              sortOrder: i + 1,
              title: `第${i + 1}段`,
              episodeStart: r.start,
              episodeEnd: r.end,
              status: 'pending',
            })),
          )
          .returning({ id: segments.id, episodeStart: segments.episodeStart, episodeEnd: segments.episodeEnd })
      : [];

    if (session.episodes > 40 && insertedSegments.length > 0) {
      const groupValues: (typeof episodeGroups.$inferInsert)[] = [];
      for (const seg of insertedSegments) {
        computeGroupRanges({ start: seg.episodeStart, end: seg.episodeEnd }).forEach((r, j) => {
          groupValues.push({
            projectId: p.id,
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
      const directRanges = computeDirectGroupRanges(session.episodes);
      if (directRanges.length > 0) {
        await tx.insert(episodeGroups).values(
          directRanges.map((r, i) => ({
            projectId: p.id,
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
      Array.from({ length: session.episodes }, (_, i) => ({
        projectId: p.id,
        episodeNumber: i + 1,
        status: 'pending',
      })),
    );

    // 去重账本（仅采纳时写入）
    await tx.insert(sparkDedupLedger).values({
      userId: uid,
      market: session.market,
      genres: session.genres,
      archetype: axes.archetype ?? '',
      spine: axes.spine ?? '',
      projectId: p.id,
    });

    return p;
  });

  await db.update(sparkDrafts).set({ status: 'adopted' }).where(eq(sparkDrafts.id, draft.id));

  if (axes.archetype) {
    await db
      .update(kbElements)
      .set({ usageCount: sql`${kbElements.usageCount} + 1`, lastUsed: new Date() })
      .where(eq(kbElements.content, axes.archetype));
  }

  return c.json({
    project_id: project.id,
    dedup_ledger_written: true,
    axes_locked: { archetype: axes.archetype ?? '', spine: axes.spine ?? '' },
  });
});

/* POST /api/spark/generate —— SSE 流式生成灵感初稿包 */
sparkRoute.post('/generate', async (c) => {
  const body = await parseJson(c, generateSchema);
  const uid = currentUserId();

  return startSSE(c, async (send) => {
    const sendStep = (step: string, index: number) => send('step', { step, index });

    // 会话 upsert
    let session: typeof sparkSessions.$inferSelect | null = null;
    if (body.session_id) {
      const rows = await db
        .select()
        .from(sparkSessions)
        .where(and(eq(sparkSessions.id, body.session_id), eq(sparkSessions.userId, uid)))
        .limit(1);
      session = rows[0] ?? null;
    }
    if (!session) {
      const [s] = await db
        .insert(sparkSessions)
        .values({
          userId: uid,
          market: body.market,
          genres: body.genres,
          episodes: body.episodes,
          duration: body.duration,
          scriptLang: body.script_language,
          dialogueLang: body.dialogue_language,
          params: {
            dedupCycle: body.dedup_cycle,
            noveltyRatio: body.novelty_ratio,
            elementGrade: body.element_grade,
            diffStrength: body.diff_strength,
          },
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        })
        .returning();
      session = s;
    }

    const [cnt] = await db
      .select({ n: count() })
      .from(sparkDrafts)
      .where(eq(sparkDrafts.sessionId, session.id));
    const draftIndex = Number(cnt?.n ?? 0) + 1;

    // 1. 读取去重账本
    sendStep('读取去重账本', 0);
    const cycleDays = dedupCycleDays(body.dedup_cycle);
    const used = await getUsedAxes(uid, body.market, cycleDays);

    const priorRows = await db
      .select({ diffAxes: sparkDrafts.diffAxes })
      .from(sparkDrafts)
      .where(eq(sparkDrafts.sessionId, session.id));
    const sessionAxes = priorRows
      .map((d) => (d.diffAxes ?? {}) as { archetype?: string; spine?: string })
      .filter((a) => a.archetype || a.spine);

    const excludeArchetypes = [...new Set([...used.archetypes, ...sessionAxes.map((a) => a.archetype ?? '')])];
    const spineExclude =
      body.diff_strength === 'low'
        ? sessionAxes.map((a) => a.spine ?? '')
        : [...used.spines, ...sessionAxes.map((a) => a.spine ?? '')];
    const excludeSpines = [...new Set(spineExclude)];

    // 2. 按最少使用选轴
    sendStep('按最少使用选轴', 1);
    const grades = gradeThreshold(body.element_grade);
    const archRow = await pickArchetype(body.market, body.genres, grades, excludeArchetypes);
    const archetype = archRow?.content ?? '';
    const archMeta = (archRow?.meta ?? {}) as Record<string, unknown>;
    const archetypeRef =
      (archMeta['reference_benchmark'] as string) || (archMeta['contrast_core'] as string) || '';
    const spine = await pickSpine(body.market, body.genres, grades, excludeSpines);

    // 3. KB 三级匹配检索
    sendStep('KB 三级匹配检索中…', 2);
    const pool = await searchKb(body.market, body.genres, grades);

    // 4. 等级与新颖度过滤
    sendStep('等级与新颖度过滤', 3);

    // 5. 拼装初稿包
    sendStep('拼装初稿包', 4);

    let parsed: ParsedSparkDraft | null = null;
    if (isRealAi()) {
      const directionText = [...body.directions, body.custom_direction].filter(Boolean).join('；');
      let prompt = buildSparkPrompt({
        market: body.market,
        genres: body.genres,
        episodes: body.episodes,
        duration: body.duration,
        scriptLang: body.script_language,
        archetype,
        archetypeRef,
        spine,
        pool,
      });
      if (directionText) prompt += `\n\n额外要求（用户希望本次调整的方向）：${directionText}。`;
      const text = await generateText(prompt, { maxTokens: 4000 });
      parsed = parseSparkDraft(text);
    }

    if (!parsed) {
      const m = mockSparkDraft();
      parsed = {
        highConcept: m.highConcept,
        characters: m.characters,
        emotion: m.emotion,
        memories: m.memories,
        risks: m.risks,
      };
    }

    const archetypeUsage = archRow?.usageCount ?? 0;
    const noveltyScore = computeNovelty(archetypeUsage, 0);
    const similarityScore = computeSimilarity(
      { archetype, spine },
      sessionAxes.map((a) => ({ archetype: a.archetype ?? '', spine: a.spine ?? '' })),
    );
    const diffValidation = noveltyScore >= 60 && similarityScore < 0.85;

    const conceptRow = pool.find((p) => p.type === 'concept');
    const sourceGrade = conceptRow?.grade ?? archRow?.grade ?? 'S';
    const highConceptSource = `KB S2 高概念库 · ${sourceGrade} 级${conceptRow?.sourceWork ? `（《${conceptRow.sourceWork}》）` : ''}`;

    const diffAxes = { archetype, spine };
    const [draftRow] = await db
      .insert(sparkDrafts)
      .values({
        sessionId: session.id,
        draftIndex,
        status: 'generated',
        highConcept: parsed.highConcept,
        highConceptSource,
        characters: parsed.characters,
        emotion: parsed.emotion,
        memories: parsed.memories,
        risks: parsed.risks,
        noveltyScore,
        similarityScore,
        diffAxes,
        rejectReasons: [],
      })
      .returning();

    await send('draft', {
      draft_id: draftRow.id,
      session_id: session.id,
      draft_index: draftIndex,
      high_concept: parsed.highConcept,
      high_concept_source: highConceptSource,
      characters: parsed.characters.map((ch, i) => ({ ...ch, color_seed: i })),
      emotion_primary: parsed.emotion.primary,
      emotion_secondary: parsed.emotion.secondary,
      emotion_aux: parsed.emotion.aux,
      emotion_rhythm: parsed.emotion.rhythm,
      memories: parsed.memories.map((m, i) => ({
        num: NUMS[i % NUMS.length],
        title: m.title,
        desc: m.desc,
        episode: m.episode,
      })),
      risks: parsed.risks,
      novelty_score: noveltyScore,
      similarity_score: similarityScore,
      archetype,
      spine,
      diff_validation: diffValidation,
    });

    await send('done', {});
  });
});
