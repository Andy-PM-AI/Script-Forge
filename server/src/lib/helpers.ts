import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { projects } from '../db/schema.ts';
import type { characters, segments, episodeGroups, episodes, scripts } from '../db/schema.ts';
import { currentUserId } from './user.ts';
import { rangeLabel } from './segments.ts';

type Row<T> = T extends { $inferSelect: infer S } ? S : never;

/** 从上下文取项目 id（父级路由 /projects/:id 传入，运行时必存在）。 */
export function projectIdOf(c: Context): string {
  return c.req.param('id') as string;
}

export async function getProject(id: string): Promise<Row<typeof projects>> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, currentUserId())))
    .limit(1);
  if (rows.length === 0) throw new HTTPException(404, { message: '项目不存在' });
  return rows[0];
}

export function progressFromStep(step: number): number {
  if (step >= 7) return 100;
  return Math.round(((step - 1) / 6) * 100);
}

export function serializeProject(p: Row<typeof projects>): Record<string, unknown> {
  // 已完成项目对用户而言等价于走到第 7 步（导出），据此展示步骤标签与 100% 进度。
  const displayStep = p.status === 'completed' ? 7 : p.currentStep;
  return {
    id: p.id,
    name: p.name,
    market: p.market,
    genres: p.genres ?? [],
    episodes: p.episodes,
    duration_min: p.durationMin,
    script_language: p.scriptLanguage,
    dialogue_language: p.dialogueLanguage,
    synopsis: p.synopsis,
    current_step: displayStep,
    status: p.status,
    color_seed: p.colorSeed,
    progress: progressFromStep(displayStep),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function serializeCharacter(c: Row<typeof characters>): Record<string, unknown> {
  return {
    id: c.id,
    source: c.source,
    name: c.name,
    gender: c.gender,
    age: c.age,
    role: c.role,
    is_protagonist: c.isProtagonist,
    traits: c.traits ?? [],
    description: c.description,
    backstory: c.backstory,
    color_seed: c.sortOrder ?? 0,
  };
}

export function serializeSegment(s: Row<typeof segments>): Record<string, unknown> {
  return {
    id: s.id,
    sort_order: s.sortOrder,
    title: s.title,
    episode_start: s.episodeStart,
    episode_end: s.episodeEnd,
    range: rangeLabel({ start: s.episodeStart, end: s.episodeEnd }),
    hook: s.hook,
    summary: s.summary,
    ending_hook: s.endingHook,
    status: s.status,
  };
}

export function serializeGroup(g: Row<typeof episodeGroups>): Record<string, unknown> {
  return {
    id: g.id,
    segment_id: g.segmentId,
    sort_order: g.sortOrder,
    label: g.label,
    episode_start: g.episodeStart,
    episode_end: g.episodeEnd,
    range: rangeLabel({ start: g.episodeStart, end: g.episodeEnd }),
    hook: g.hook,
    summary: g.summary,
    ending_hook: g.endingHook,
    status: g.status,
  };
}

export function serializeEpisode(e: Row<typeof episodes>): Record<string, unknown> {
  return {
    id: e.id,
    episode_number: e.episodeNumber,
    title: e.title,
    hook: e.hook,
    synopsis: e.synopsis,
    key_scenes: e.keyScenes ?? [],
    status: e.status,
  };
}

export function serializeScript(s: Row<typeof scripts>, withContent = false): Record<string, unknown> {
  const base: Record<string, unknown> = {
    episode_number: s.episodeNumber,
    status: s.status,
    scene_count: s.sceneCount,
    word_count: s.wordCount,
  };
  if (withContent) base.content = s.content;
  return base;
}
