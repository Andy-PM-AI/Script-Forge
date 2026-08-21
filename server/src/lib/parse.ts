const LABELS = ['标题', '开场钩子', '剧情简介', '关键场次', '结尾钩子', '姓名', '年龄', '身份', '性别', '性格特点', '经历介绍'];

const LABEL_RE = new RegExp(`^\\s*(${LABELS.join('|')})\\s*[：:]\\s*(.*)$`);

/** 解析「标签：内容」形式的多行文本，返回标签 → 内容映射。 */
export function parseLabeled(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const buf: string[] = [];
  let current: string | null = null;

  const flush = () => {
    if (current) out[current] = buf.join('\n').trim();
    buf.length = 0;
  };

  for (const line of text.split('\n')) {
    const m = line.match(LABEL_RE);
    if (m) {
      flush();
      current = m[1];
      if (m[2]) buf.push(m[2]);
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

/** 按 [SECTION:xxx] 分割整段响应。 */
export function parseSections(text: string): { characters: string; background: string; storyline: string } {
  const grab = (name: string): string => {
    const m = text.match(new RegExp(`\\[SECTION:${name}\\][\\s\\S]*?(?=\\[SECTION:|$)`));
    return (m?.[0] ?? '').replace(new RegExp(`^\\[SECTION:${name}\\]\\s*`), '').trim();
  };
  return { characters: grab('CHARACTERS'), background: grab('BACKGROUND'), storyline: grab('STORYLINE') };
}

export interface ParsedCharacter {
  name: string;
  age: string;
  role: string;
  gender: string;
  traits: string[];
  backstory: string;
}

/** 将 CHARACTERS 区段解析为人物数组（按空行分块，块内用「标签：」读取）。 */
export function parseCharacters(section: string): ParsedCharacter[] {
  const blocks = section
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const chars: ParsedCharacter[] = [];
  for (const block of blocks) {
    const kv = parseLabeled(block);
    const name = kv['姓名']?.trim();
    if (!name) continue;
    chars.push({
      name,
      age: kv['年龄']?.trim() ?? '',
      role: kv['身份']?.trim() ?? '',
      gender: normalizeGender(kv['性别']?.trim() ?? ''),
      traits: splitList(kv['性格特点'] ?? ''),
      backstory: kv['经历介绍']?.trim() ?? '',
    });
  }
  return chars;
}

export function splitList(text: string): string[] {
  return text
    .split(/[、，,；;\n/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeGender(g: string): string {
  if (/女/.test(g)) return 'female';
  if (/男/.test(g)) return 'male';
  if (/其他|其它|未知|不透露/.test(g)) return 'other';
  return g || 'other';
}

export interface ScriptStats {
  wordCount: number;
  sceneCount: number;
}

/** 统计分镜脚本字数与场次数（§6.6 解析规则）。 */
export function countScriptStats(content: string): ScriptStats {
  const sceneCount = content.split('\n').filter((l) => /^\d+-\d+\s/.test(l.trim())).length;
  const wordCount = content.replace(/\s+/g, '').length;
  return { wordCount, sceneCount };
}

/** 导出文件名规则（§8）。 */
export function exportFilename(projectName: string, ext: string, episodeNumber?: number): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const ts = String(Math.floor(Date.now() / 1000)).slice(-6);
  const ep = episodeNumber ? `_第${episodeNumber}集` : '_全剧';
  return `${projectName}${ep}_${dateStr}_${ts}.${ext}`;
}

/** 解析 AI 推荐姓名（「姓名|推荐理由」逐行，跳过无 | 的行，reason 截断 100 字，最多 5 条）。 */
export function parseNameRecommendations(text: string): { name: string; reason: string }[] {
  const results: { name: string; reason: string }[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t.includes('|')) continue;
    const idx = t.indexOf('|');
    const name = t.slice(0, idx).trim();
    const reason = t.slice(idx + 1).trim();
    if (name && reason) results.push({ name, reason: reason.slice(0, 100) });
    if (results.length >= 5) break;
  }
  return results;
}

/** 转义正则特殊字符，用于名字全局替换。 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
