import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { kbElements, sparkDedupLedger } from '../db/schema.ts';

type KbRow = typeof kbElements.$inferSelect;

/* ── 参数映射 ── */

export function gradeThreshold(grade: string): string[] {
  if (grade === 'S') return ['S'];
  if (grade === 'SA') return ['S', 'A'];
  return ['S', 'A', 'B'];
}

/** 去重周期 → 天数；session 返回 null（仅会话内去重），all 返回 Infinity（全历史）。 */
export function dedupCycleDays(cycle: string): number | null {
  if (cycle === 'session') return null;
  if (cycle === 'all') return Infinity;
  const n = Number(cycle.replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 90;
}

/* ── 去重账本 ── */

export interface UsedAxes {
  archetypes: string[];
  spines: string[];
}

export async function getUsedAxes(
  userId: string,
  market: string,
  cycleDays: number | null,
): Promise<UsedAxes> {
  if (cycleDays === null) return { archetypes: [], spines: [] };

  const rows = await db
    .select({
      archetype: sparkDedupLedger.archetype,
      spine: sparkDedupLedger.spine,
      adoptedAt: sparkDedupLedger.adoptedAt,
    })
    .from(sparkDedupLedger)
    .where(and(eq(sparkDedupLedger.userId, userId), eq(sparkDedupLedger.market, market)));

  let filtered = rows;
  if (cycleDays !== Infinity) {
    const since = Date.now() - cycleDays * 24 * 60 * 60 * 1000;
    filtered = rows.filter((r) => (r.adoptedAt ? r.adoptedAt.getTime() >= since : false));
  }

  return {
    archetypes: [...new Set(filtered.map((r) => r.archetype))],
    spines: [...new Set(filtered.map((r) => r.spine))],
  };
}

/* ── KB 检索 ── */

function filterByGenre(rows: KbRow[], genres: string[]): KbRow[] {
  if (genres.length === 0) return rows;
  const gs = new Set(genres.map((g) => g.toLowerCase()));
  const hit = rows.filter((r) => (r.genreTags ?? []).some((t) => gs.has(t.toLowerCase())));
  return hit.length > 0 ? hit : rows; // 无命中则退回全量，避免空池
}

function pickLeastUsed<T extends KbRow>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  const min = Math.min(...rows.map((r) => r.usageCount));
  const least = rows.filter((r) => r.usageCount === min);
  return least[Math.floor(Math.random() * least.length)];
}

/** 选择最少使用的人物原型（差异化轴之一）。axis 标识 = 整条 content（role_type「code」｜contrast_core）。 */
export async function pickArchetype(
  market: string,
  genres: string[],
  grades: string[],
  exclude: string[],
): Promise<KbRow | null> {
  const rows = await db
    .select()
    .from(kbElements)
    .where(and(eq(kbElements.type, 'archetype'), inArray(kbElements.grade, grades)));
  const pool = filterByGenre(rows, genres);
  const candidates = pool.filter((r) => !exclude.includes(r.content));
  return pickLeastUsed(candidates.length > 0 ? candidates : pool);
}

/** 选择最少使用的情感主轴（差异化轴之二）。spine 形如「救赎感+窒息感」。 */
export async function pickSpine(
  market: string,
  genres: string[],
  grades: string[],
  exclude: string[],
): Promise<string> {
  const rows = await db
    .select()
    .from(kbElements)
    .where(
      and(
        inArray(kbElements.type, ['archetype', 'hook', 'snapshot', 'scene', 'memory']),
        inArray(kbElements.grade, grades),
      ),
    );
  const pool = filterByGenre(rows, genres);

  const counter = new Map<string, { count: number; usage: number }>();
  for (const r of pool) {
    for (const tag of r.emotionTags ?? []) {
      const cur = counter.get(tag) ?? { count: 0, usage: 0 };
      cur.count += 1;
      cur.usage += r.usageCount;
      counter.set(tag, cur);
    }
  }

  const excludeTags = new Set(exclude.flatMap((s) => s.split('+')));
  let entries = [...counter.entries()].filter(([t]) => t && !excludeTags.has(t));
  if (entries.length === 0) entries = [...counter.entries()];

  // 使用次数少优先；使用相同时，出现频次高的更「稳」优先。
  entries.sort((a, b) => a[1].usage - b[1].usage || b[1].count - a[1].count);
  const top = entries.slice(0, Math.max(2, Math.min(8, entries.length)));

  const a = top[Math.floor(Math.random() * top.length)]?.[0] ?? '救赎感';
  const b = top.find(([t]) => t !== a)?.[0] ?? '';
  return b ? `${a}+${b}` : a;
}

/** 三级检索：按题材 + 等级召回各类型素材，供 LLM 拼装参考。 */
export async function searchKb(
  market: string,
  genres: string[],
  grades: string[],
  perType = 4,
): Promise<KbRow[]> {
  const types = ['concept', 'hook', 'scene', 'snapshot', 'dialogue', 'memory'];
  const rows = await db
    .select()
    .from(kbElements)
    .where(and(inArray(kbElements.type, types), inArray(kbElements.grade, grades)));
  const pool = filterByGenre(rows, genres);

  const out: KbRow[] = [];
  for (const t of types) {
    const group = pool.filter((r) => r.type === t);
    group.sort((a, b) => a.usageCount - b.usageCount);
    out.push(...group.slice(0, perType));
  }
  return out;
}

/* ── 提示词与解析 ── */

const MARKET_LABELS: Record<string, string> = {
  global: '欧美（英文 romance 市场）',
  latam: '拉美（西/葡语市场）',
  china: '中国（中文短剧市场）',
};

export function buildSparkPrompt(opts: {
  market: string;
  genres: string[];
  episodes: number;
  duration: number;
  scriptLang: string;
  archetype: string;
  archetypeRef: string;
  spine: string;
  pool: KbRow[];
}): string {
  const poolText = opts.pool
    .map((r) => `[${r.type} · ${r.grade}级 · 来源《${r.sourceWork ?? '—'}》] ${r.content}`)
    .join('\n');
  const lang = opts.scriptLang === 'en' ? '英文' : '中文';

  return `你是一位顶级${MARKET_LABELS[opts.market] ?? opts.market}短剧编剧与制片人顾问。
请根据以下约束，生成一个完整的短剧灵感初稿包。输出必须使用${lang}。

目标市场：${MARKET_LABELS[opts.market] ?? opts.market}
故事题材：${opts.genres.join('、') || '不限'}
全剧集数：${opts.episodes} 集
全剧时长：${opts.duration} 分钟
差异化人物原型：${opts.archetype}
原型参照：${opts.archetypeRef || '无'}
差异化情感主轴：${opts.spine}

可参考的爆款素材（仅作灵感，勿照抄）：
${poolText || '（无）'}

请严格输出一个 JSON 对象（不要输出任何其它文字、注释或 markdown 代码块标记），结构如下：
{
  "high_concept": "一句话高概念（含核心冲突）",
  "characters": [
    { "name": "姓名", "role": "女主/男主/反派等", "archetype": "原型参照说明", "description": "人物设定描述（100字内）" }
  ],
  "emotion": {
    "primary": "主情感（围绕差异化情感主轴）",
    "secondary": ["次情感1", "次情感2"],
    "aux": ["辅助情感"],
    "rhythm": "情感节奏分布，如：前1/3甜 → 中1/3虐 → 后1/3爽"
  },
  "memories": [
    { "title": "记忆点标题", "desc": "关键剧情节点描述", "episode": "建议第 N 集" }
  ],
  "risks": [
    { "level": "high|medium|low", "desc": "风险描述", "mitigation": "规避方案" }
  ]
}

要求：
- characters 恰好 3 个（女主、男主、反派各 1 个，姓名需符合${opts.market === 'china' ? '中文' : '海外'}市场习惯）。
- memories 恰好 3 个，按剧情先后排序。
- risks 恰好 3 条，分别对应 high/medium/low。
- 全部内容必须呼应「差异化人物原型」与「差异化情感主轴」，避免落入题材俗套。`;
}

export interface ParsedSparkDraft {
  highConcept: string;
  characters: { name: string; role: string; archetype: string; description: string }[];
  emotion: { primary: string; secondary: string[]; aux: string[]; rhythm: string };
  memories: { title: string; desc: string; episode: string }[];
  risks: { level: 'high' | 'medium' | 'low'; desc: string; mitigation: string }[];
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asString).filter(Boolean);
  return [];
}
function asRiskLevel(v: unknown): 'high' | 'medium' | 'low' {
  const s = asString(v).toLowerCase();
  return s === 'high' || s === 'medium' || s === 'low' ? s : 'medium';
}

/** 从 LLM 文本中提取并归一化 JSON 初稿（容错处理代码块围栏与前后杂音）。 */
export function parseSparkDraft(text: string): ParsedSparkDraft | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  t = t.slice(start, end + 1);

  let obj: unknown;
  try {
    obj = JSON.parse(t);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;

  const charList = (Array.isArray(o['characters']) ? o['characters'] : []) as Record<string, unknown>[];
  const emotionRaw = (o['emotion'] ?? {}) as Record<string, unknown>;

  return {
    highConcept: asString(o['high_concept']),
    characters: charList.slice(0, 6).map((c) => ({
      name: asString(c['name']),
      role: asString(c['role']),
      archetype: asString(c['archetype']),
      description: asString(c['description']),
    })),
    emotion: {
      primary: asString(emotionRaw['primary']),
      secondary: asStringArray(emotionRaw['secondary']),
      aux: asStringArray(emotionRaw['aux']),
      rhythm: asString(emotionRaw['rhythm']),
    },
    memories: (Array.isArray(o['memories']) ? o['memories'] : [])
      .slice(0, 6)
      .map((m) => ({
        title: asString((m as Record<string, unknown>)['title']),
        desc: asString((m as Record<string, unknown>)['desc']),
        episode: asString((m as Record<string, unknown>)['episode']),
      })),
    risks: (Array.isArray(o['risks']) ? o['risks'] : [])
      .slice(0, 3)
      .map((r) => ({
        level: asRiskLevel((r as Record<string, unknown>)['level']),
        desc: asString((r as Record<string, unknown>)['desc']),
        mitigation: asString((r as Record<string, unknown>)['mitigation']),
      })),
  };
}

/* ── 评分（启发式，无嵌入模型时的确定性近似） ── */

export function computeNovelty(archetypeUsage: number, spineUsage: number): number {
  const usage = Math.max(archetypeUsage, spineUsage);
  if (usage === 0) return 90 + Math.floor(Math.random() * 6); // 90–95
  return Math.max(55, 90 - usage * 7);
}

export function computeSimilarity(
  axes: { archetype: string; spine: string },
  rejectHistory: { archetype: string; spine: string }[],
): number {
  if (rejectHistory.length === 0) return 0;
  const scores = rejectHistory.map((h) => {
    let s = 0;
    if (h.archetype && h.archetype === axes.archetype) s += 0.6;
    if (h.spine && h.spine === axes.spine) s += 0.4;
    return s;
  });
  return Math.max(...scores);
}

/* ── 离线兜底 ── */

export interface MockDraftPayload {
  highConcept: string;
  characters: { name: string; role: string; archetype: string; description: string }[];
  emotion: { primary: string; secondary: string[]; aux: string[]; rhythm: string };
  memories: { title: string; desc: string; episode: string }[];
  risks: { level: 'high' | 'medium' | 'low'; desc: string; mitigation: string }[];
}

export function mockSparkDraft(): MockDraftPayload {
  return {
    highConcept: '被狼人 Alpha 标记的人类少女，在复仇路上发现自己才是百年预言中的狼王转世。',
    characters: [
      { name: '艾拉·温特斯', role: '女主', archetype: '参照：暮光之城 Bella × 黑化版', description: '表面上柔弱的人类少女，内心藏着与生俱来的狼族血脉，为父复仇入局权力游戏，最终觉醒真实身份。' },
      { name: '凯恩·布莱克', role: '男主', archetype: '参照：征服者+救赎者型 Alpha', description: '狼群中最强大的 Alpha，外表冷酷强硬，内心深处为古老预言所困。' },
      { name: '维克多·格雷', role: '反派', archetype: '参照：权谋型幕后黑手', description: '杀害艾拉父亲的幕后主使，同时觊觎狼王之位，城府深沉。' },
    ],
    emotion: { primary: '救赎感', secondary: ['窒息感', '占有欲', '宿命感'], aux: ['禁忌感', '成长'], rhythm: '前 1/3 甜 → 中 1/3 虐 → 后 1/3 爽，密度比 2:3:2' },
    memories: [
      { title: '女主第一次变身', desc: '在满月之夜被迫变身，震惊全场，艾拉意识到自己并非普通人类。', episode: '建议第 3 集' },
      { title: '标记反噬', desc: 'Alpha 的标记反而成为女主复仇的武器，双方陷入权力博弈。', episode: '建议第 15 集' },
      { title: '狼王觉醒', desc: '最终集女主觉醒完整狼王之力，彻底颠覆权力格局。', episode: '建议第 40 集' },
    ],
    risks: [
      { level: 'high', desc: '狼人 Alpha 题材在欧美市场已高度饱和，首 3 集必须有差异化钩子', mitigation: '开篇用「女主主动复仇」而非「被动被救」切入' },
      { level: 'medium', desc: '标记/占有情节可能触发平台内容审核', mitigation: '将「强制标记」改为「双向选择下的契约标记」' },
      { level: 'low', desc: '复仇主线与感情主线节奏易失衡', mitigation: '严格执行「每 5 集一个推进节点」节奏公式' },
    ],
  };
}
