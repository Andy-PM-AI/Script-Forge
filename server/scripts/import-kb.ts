/**
 * KB 素材库导入脚本：短剧爆款素材库.xlsx → kb_elements 表。
 * 用法：cd server && npx tsx scripts/import-kb.ts [xlsx路径]
 * 覆盖写入（先 TRUNCATE kb_elements），可重复执行。
 */
import fs from 'node:fs';
import XLSX from 'xlsx';
import { sql, db } from '../src/db/client.ts';
import { kbElements } from '../src/db/schema.ts';

// 加载 server/.env（Node 22 原生）
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.('.env');
} catch {
  /* 忽略 */
}

const XLSX_PATH = process.argv[2] ?? '/Users/xuning/Desktop/AI漫剧/短剧爆款素材库.xlsx';

type Row = Record<string, string>;

function sheetObjects(name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
  if (rows.length < 2) return [];
  const header = (rows[0] as unknown[]).map((h) => String(h).trim());
  return (rows.slice(1) as unknown[]).map((r) => {
    const o: Row = {};
    header.forEach((h, i) => {
      o[h] = String(r[i] ?? '').trim();
    });
    return o;
  });
}

function splitTags(s: string): string[] {
  return String(s ?? '')
    .split(/[;；、，,→/\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function uniq(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

function normGrade(g: string): 'S' | 'A' | 'B' | 'C' {
  const v = String(g ?? '').trim().toUpperCase().charAt(0);
  return v === 'S' || v === 'A' || v === 'B' || v === 'C' ? v : 'B';
}

interface NovelMeta {
  title: string;
  genres: string[];
  emotions: string[];
}

const buf = fs.readFileSync(XLSX_PATH);
const wb = XLSX.read(buf, { type: 'buffer' });

// 小说元数据表（novel_id → 标题/题材/情感）
const novelMeta = new Map<string, NovelMeta>();
for (const r of sheetObjects('S1_项目信息卡')) {
  const id = r['novel_id'];
  if (!id) continue;
  novelMeta.set(id, {
    title: r['novel_title'] || '',
    genres: splitTags(r['genre_tags']),
    emotions: splitTags(r['emotion_tags']),
  });
}

interface ElementRec {
  type: string;
  grade: 'S' | 'A' | 'B' | 'C';
  content: string;
  genreTags: string[];
  emotionTags: string[];
  sourceWork: string;
  meta: Record<string, unknown>;
}

const recs: ElementRec[] = [];
const novelOf = (id: string) => novelMeta.get(id) ?? { title: '', genres: [], emotions: [] };

function push(type: string, r: Row, grade: string, content: string, genres: string[], emotions: string[], meta: Record<string, unknown>) {
  const n = novelOf(r['novel_id']);
  const title = n.title || r['novel_title'] || '';
  if (!content.trim()) return;
  recs.push({
    type,
    grade: normGrade(grade),
    content: content.trim(),
    genreTags: uniq([...genres, ...n.genres]),
    emotionTags: uniq([...emotions, ...n.emotions]),
    sourceWork: title,
    meta: { ...meta, novel_id: r['novel_id'] || null },
  });
}

// S2 高概念世界观库 → concept
for (const r of sheetObjects('S2_高概念世界观库')) {
  push(
    'concept',
    r,
    r['reuse_priority'],
    `${r['setting_name']}｜${r['one_liner']}`.replace(/^｜/, ''),
    [...splitTags(r['compatible_genres']), ...splitTags(r['concept_tags'])],
    [],
    {
      element_id: r['element_id'],
      setting_name: r['setting_name'],
      portability: r['portability'],
      adaptation_difficulty: r['adaptation_difficulty'],
      adaptation_suggestion: r['adaptation_suggestion'],
      source_anchor: r['source_anchor'],
    },
  );
}

// S3 极致人设卡库 → archetype
for (const r of sheetObjects('S3_极致人设卡库')) {
  push(
    'archetype',
    r,
    r['reuse_priority'],
    `${r['role_type']}「${r['code']}」｜${r['contrast_core']}`,
    splitTags(r['compatible_genres']),
    splitTags(r['personality_tags']),
    {
      element_id: r['element_id'],
      code: r['code'],
      role_type: r['role_type'],
      reference_benchmark: r['reference_benchmark'],
      contrast_core: r['contrast_core'],
      core_desire: r['core_desire'],
      fatal_flaw: r['fatal_flaw'],
      signature_dialogue_zh: r['signature_dialogue_zh'],
      reveal_episode: r['reveal_episode'],
      source_anchor: r['source_anchor'],
    },
  );
}

// S4 结构公式库 → structure
for (const r of sheetObjects('S4_结构公式库')) {
  push(
    'structure',
    r,
    'B',
    `${r['act_name']}（${r['chapter_range']}）｜${r['core_event']}`,
    [],
    splitTags(r['emotion_flow']),
    {
      element_id: r['element_id'],
      record_type: r['record_type'],
      act_name: r['act_name'],
      chapter_range: r['chapter_range'],
      function_note: r['function_note'],
      source_anchor: r['source_anchor'],
    },
  );
}

// S5 冲突场景模板库 → scene
for (const r of sheetObjects('S5_冲突场景模板库')) {
  push(
    'scene',
    r,
    r['reuse_priority'],
    `${r['scene_name']}｜${r['deidentified_template']}`,
    splitTags(r['scene_tags']),
    splitTags(r['emotion_landing']),
    {
      element_id: r['element_id'],
      scene_name: r['scene_name'],
      trigger_condition: r['trigger_condition'],
      suggested_position: r['suggested_position'],
      reuse_difficulty: r['reuse_difficulty'],
      source_anchor: r['source_anchor'],
    },
  );
}

// S6 情绪钩子库 → hook
for (const r of sheetObjects('S6_情绪钩子库')) {
  push(
    'hook',
    r,
    r['reuse_priority'],
    `${r['episode']}｜${r['ending_event']}｜钩：${r['audience_question']}`,
    splitTags(r['hook_tags']),
    splitTags(r['emotion_landing']),
    {
      element_id: r['element_id'],
      hook_type: r['hook_type'],
      technique_note: r['technique_note'],
      emotion_value: r['emotion_value'],
      source_anchor: r['source_anchor'],
    },
  );
}

// S7 台词模板库 → dialogue
for (const r of sheetObjects('S7_台词模板库')) {
  const zh = r['template_zh'] || r['template'];
  push(
    'dialogue',
    r,
    r['reuse_priority'],
    `${r['scene_type']}｜${zh}`,
    splitTags(r['dialogue_tags']),
    splitTags(r['applicable_emotion']),
    {
      element_id: r['element_id'],
      scene_type: r['scene_type'],
      template_en: r['template'],
      usage_suggestion: r['usage_suggestion'],
      source_anchor: r['source_anchor'],
    },
  );
}

// S8 场景快照库 → snapshot
for (const r of sheetObjects('S8_场景快照库')) {
  push(
    'snapshot',
    r,
    r['reuse_priority'],
    `${r['scene_name']}｜${r['what']}`,
    splitTags(r['scene_tags']),
    splitTags(r['emotion_effect']),
    {
      element_id: r['element_id'],
      where: r['where'],
      when: r['when'],
      how: r['how'],
      visual_hint: r['visual_hint'],
      source_anchor: r['source_anchor'],
    },
  );
}

// S9 记忆点库 → memory
for (const r of sheetObjects('S9_记忆点库')) {
  push(
    'memory',
    r,
    'S',
    `${r['core_memory_point']}｜${r['slogan']}`,
    [],
    [],
    { core_memory_point: r['core_memory_point'], slogan: r['slogan'] },
  );
}

console.log(`解析到 ${recs.length} 条 KB 元素，开始写入…`);

// 清空后批量写入
await sql`TRUNCATE kb_elements`;

const BATCH = 500;
for (let i = 0; i < recs.length; i += BATCH) {
  const slice = recs.slice(i, i + BATCH);
  await db.insert(kbElements).values(
    slice.map((r) => ({
      market: 'global',
      genreTags: r.genreTags,
      emotionTags: r.emotionTags,
      type: r.type,
      grade: r.grade,
      content: r.content,
      usageCount: 0,
      sourceWork: r.sourceWork || null,
      meta: r.meta,
    })),
  );
  process.stdout.write(`\r已写入 ${Math.min(i + BATCH, recs.length)} / ${recs.length}`);
}
console.log('\n✓ KB 导入完成');

// 统计
const stats = await sql`
  SELECT type, grade, count(*)::int AS n FROM kb_elements GROUP BY type, grade ORDER BY type, grade
`;
console.table(stats.map((r) => ({ type: r.type, grade: r.grade, n: r.n })));

process.exit(0);
