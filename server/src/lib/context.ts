import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { characters, episodeGroups, episodes, projects, step2Results } from '../db/schema.ts';
import type { ParsedCharacter } from './parse.ts';

/** 读取 step2 生成结果（background/storyline），可能为 null。 */
export async function getStep2Result(projectId: string) {
  const rows = await db
    .select()
    .from(step2Results)
    .where(eq(step2Results.projectId, projectId))
    .limit(1);
  return rows[0] ?? null;
}

/** 读取用于下游 prompt 的人物（优先 ai_generated，否则退回 user_input）。 */
export async function getCharactersForPrompt(projectId: string): Promise<ParsedCharacter[]> {
  const rows = await db
    .select()
    .from(characters)
    .where(eq(characters.projectId, projectId))
    .orderBy(asc(characters.sortOrder));
  const preferred = rows.filter((r) => r.source === 'ai_generated');
  const source = preferred.length > 0 ? preferred : rows;
  return source.map((c) => ({
    name: c.name,
    age: c.age ?? '',
    role: c.role ?? '',
    gender: c.gender ?? 'other',
    traits: c.traits ?? [],
    backstory: c.backstory ?? c.description ?? '',
  }));
}

/** 下游步骤统一引用的「故事圣经」：人物设定 + 背景 + 故事线。 */
export interface StoryBible {
  characters: ParsedCharacter[];
  background: string;
  storyline: string;
}

/** 读取 step2 产出的「故事圣经」，供第 5/6 步强制统一人物与世界观。 */
export async function getStoryBible(projectId: string): Promise<StoryBible> {
  const [characters, step2] = await Promise.all([
    getCharactersForPrompt(projectId),
    getStep2Result(projectId),
  ]);
  return {
    characters,
    background: step2?.background ?? '',
    storyline: step2?.storyline ?? '',
  };
}

/** 返回上一集（epNum-1）的剧情简介，用于跨集衔接；第一集返回 null。 */
export async function getPrevEpisodeSynopsis(projectId: string, epNum: number): Promise<string | null> {
  if (epNum <= 1) return null;
  const rows = await db
    .select({ synopsis: episodes.synopsis })
    .from(episodes)
    .where(and(eq(episodes.projectId, projectId), eq(episodes.episodeNumber, epNum - 1)))
    .limit(1);
  return rows[0]?.synopsis ?? null;
}

/** 返回某集的父级大纲上下文（>40 集用 episode_groups，否则用 step2 故事线兜底）。 */
export async function getEpisodeParentContext(projectId: string, epNum: number) {
  const groups = await db
    .select()
    .from(episodeGroups)
    .where(eq(episodeGroups.projectId, projectId))
    .orderBy(asc(episodeGroups.sortOrder));
  const group = groups.find((g) => g.episodeStart <= epNum && epNum <= g.episodeEnd);
  if (group) {
    return {
      range: { start: group.episodeStart, end: group.episodeEnd },
      hook: group.hook ?? '',
      summary: group.summary ?? '',
      endingHook: group.endingHook ?? '',
    };
  }

  const [proj] = await db
    .select({ episodes: projects.episodes })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const step2 = await getStep2Result(projectId);
  return {
    range: { start: 1, end: proj?.episodes ?? 1 },
    hook: '',
    summary: step2?.storyline ?? '',
    endingHook: '',
  };
}
