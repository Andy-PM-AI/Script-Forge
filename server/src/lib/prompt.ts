import type { ParsedCharacter } from './parse.ts';

const MARKET_LABEL: Record<string, string> = { china: '中国', global: '欧美', latam: '拉美' };
const DIALOGUE_LABEL: Record<string, string> = { zh: '中文', en: '英文', 'en-zh': '英（主）中（辅）' };

export interface Step1Input {
  market: string;
  genres: string[];
  episodes: number;
  durationMin: number;
  scriptLanguage: string;
  dialogueLanguage: string;
  synopsis: string | null;
  characters: { name: string; gender: string; isProtagonist: boolean; description: string | null }[];
}

/** Step1 → Step2（人物/背景/故事线，一次生成三者，[SECTION] 分隔）。 */
export function buildStep2Prompt(p: Step1Input): string {
  const marketLabel = MARKET_LABEL[p.market] ?? p.market;
  const genreLabel = p.genres.join('、') || '（未选择）';
  const synopsisText = p.synopsis?.trim() || '（未填写）';
  const charsText =
    p.characters
      .map(
        (c) =>
          `${c.name}（${c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'}，${c.isProtagonist ? '主角' : '配角'}）：${c.description || '无介绍'}`,
      )
      .join('\n') || '（未填写）';

  return `你现在是最资深最有才华且写出过「${marketLabel}」大爆款的短剧编剧。
我准备要做一部面向「${marketLabel}」的AI仿真人短剧，故事题材属于「${genreLabel}」，全剧共「${p.episodes}」集，总时长「${p.durationMin}」分钟。
故事梗概如下：「${synopsisText}」
人物小传如下：「${charsText}」
根据以上信息，先帮我生成完整的人物设定、背景设定和故事线，要求如下：
1. 如果有角色还没有确定的姓名时，可以根据剧情给该角色起一个合适的名字
2. 如果人物小传和故事梗概存在不一致时，以人物小传为准
3. 生成人物设定时，如果有人物小传中没列出的重要角色，可以新增
4. 人物设定按照以下格式生成：角色姓名、角色年龄、角色身份（男主/女主/女配/反派等）、性格特点、经历介绍
5. 背景设定和故事线要与人物设定相呼应，且要有完整的世界观、时代背景、地点等描述
6. 故事线要包含主线、副线A、感情线等，且要有完整的故事发展脉络
7. 如果面向中国市场，则全部使用中文输出；如果面向非中国市场，人物姓名和故事线中的地名、机构名等专有名词使用英文名称并进行中文翻译，其它内容使用中文输出
8. 确保生成的内容符合短剧的快节奏要求，剧情紧凑、冲突感强、悬念感强、情绪感强
9. 确保生成的人名、故事情节、背景设定、故事线等内容不会与现实中存在的任何人、事、物产生关联，避免涉及敏感话题，同时确保不会与任何已知的影视作品、小说、漫画、游戏等产生关联，避免因抄袭或雷同而产生版权问题

请严格按以下分隔标记输出，便于程序解析：
[SECTION:CHARACTERS]
每个人物一个块，块内每行一个字段，格式如下：
姓名：角色姓名
年龄：角色年龄
身份：角色身份
性别：男/女/其他
性格特点：特点一、特点二、特点三
经历介绍：角色经历介绍
（多个角色之间用空行分隔）

[SECTION:BACKGROUND]
背景设定内容（世界观/时代背景/地点等，多段描述）

[SECTION:STORYLINE]
故事线内容（主线、副线A、感情线等，分段描述）`;
}

/** 拼接 Step3 逐段生成的上下文与指令。 */
export function buildSegmentPrompt(p: {
  market: string;
  episodes: number;
  durationMin: number;
  characters: ParsedCharacter[];
  background: string;
  storyline: string;
  range: { start: number; end: number };
}): string {
  const charsText = p.characters
    .map((c) => `${c.name}（${c.age}，${c.role}）\n性格：${c.traits.join('、')}\n经历：${c.backstory}`)
    .join('\n\n');
  return `现在人物设定已确定如下：
「${charsText}」
背景设定已确定如下：
「${p.background}」
故事线已确定如下：
「${p.storyline}」
全剧共「${p.episodes}」集，总时长「${p.durationMin}」分钟。

请为「第 ${p.range.start}–${p.range.end} 集」这一段撰写剧情大纲，要求：
1. 与前后段落的剧情要有连贯性
2. 要合理安排几条故事线的节奏，几条故事线穿插进行
3. 遇到信息不一致时，优先以人物设定为准，其次为背景设定，最后是故事线

请严格按以下格式输出：
开场钩子：一句话开场钩子
剧情简介：约1000字剧情简介
结尾钩子：一句话结尾钩子`;
}

/** Step3 → Step4（以 5 集为小段，逐小段生成）。 */
export function buildGroupPrompt(
  segment: { range: { start: number; end: number }; hook: string; summary: string; endingHook: string },
  groupRange: { start: number; end: number },
): string {
  return `现在分段大纲已确定，「第 ${segment.range.start}–${segment.range.end} 集」这一大段的大纲内容如下：
「剧情简介：${segment.summary}
开篇钩子：${segment.hook}
结尾钩子：${segment.endingHook}」

请为其中的「第 ${groupRange.start}–${groupRange.end} 集」这一小段（每 5 集一段）撰写剧情大纲，要求：
1. 与前后小段之间的剧情要有连贯性
2. 要合理安排几条故事线的节奏，几条故事线穿插进行
3. 第一小段的开场要对应上一步大段的开场钩子，最后一个小段的结尾要对应上一步大段的结尾钩子

请严格按以下格式输出（先输出该小段集数范围，再输出三要素）：
集数范围：第 ${groupRange.start}–${groupRange.end} 集
开场钩子：一句话开场钩子
剧情简介：约1000字剧情简介
结尾钩子：一句话结尾钩子`;
}

/** Step2 → Step4（≤40 集直接分小段，跳过第三步分段粗纲）。 */
export function buildDirectGroupPrompt(
  p: {
    market: string;
    episodes: number;
    durationMin: number;
    characters: ParsedCharacter[];
    background: string;
    storyline: string;
    range: { start: number; end: number };
    size: number;
  },
): string {
  const charsText = p.characters
    .map((c) => `${c.name}（${c.age}，${c.role}）\n性格：${c.traits.join('、')}\n经历：${c.backstory}`)
    .join('\n\n');
  return `现在人物设定已确定如下：
「${charsText}」
背景设定已确定如下：
「${p.background}」
故事线已确定如下：
「${p.storyline}」
全剧共「${p.episodes}」集，总时长「${p.durationMin}」分钟。

请为「第 ${p.range.start}–${p.range.end} 集」这一小段（每 ${p.size} 集一段）撰写剧情大纲，要求：
1. 与前后小段之间的剧情要有连贯性
2. 要合理安排几条故事线的节奏，几条故事线穿插进行
3. 第一小段的开场要对应全剧的开头，最后一个小段的结尾要对应全剧的结尾

请严格按以下格式输出（先输出该小段集数范围，再输出三要素）：
集数范围：第 ${p.range.start}–${p.range.end} 集
开场钩子：一句话开场钩子
剧情简介：约1000字剧情简介
结尾钩子：一句话结尾钩子`;
}

/** 将人物列表格式化为统一的人物设定文本块，供下游 prompt 注入。 */
function charactersBlock(characters: ParsedCharacter[]): string {
  if (characters.length === 0) return '（无人物设定）';
  return characters
    .map(
      (c) =>
        `${c.name}（${c.age}，${c.role}，${c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'}）\n性格：${c.traits.join('、')}\n经历：${c.backstory}`,
    )
    .join('\n\n');
}

/** Step4/3 → Step5（逐集生成大纲）。 */
export function buildEpisodePrompt(
  parent: { range: { start: number; end: number }; hook: string; summary: string; endingHook: string },
  epNum: number,
  bible: { characters: ParsedCharacter[]; background: string; storyline: string },
  prevSynopsis?: string | null,
): string {
  const prevText = prevSynopsis ? `\n上一集（第 ${epNum - 1} 集）已确定的剧情如下：「${prevSynopsis}」` : '';
  return `现在人物设定已确定如下：
「${charactersBlock(bible.characters)}」

背景设定已确定如下：
「${bible.background}」

故事线已确定如下：
「${bible.storyline}」

现在分段大纲已确定，「第 ${epNum} 集所在段落（第 ${parent.range.start}–${parent.range.end} 集）」的大纲内容如下：
「剧情简介：${parent.summary}
开篇钩子：${parent.hook}
结尾钩子：${parent.endingHook}」
${prevText}

请为「第 ${epNum} 集」撰写单集剧情大纲，要求：
1. 人物姓名、身份、家族/势力名必须与上面的人物设定严格一致，禁止新增角色名、改名或混用；若故事线与人物设定冲突，以人物设定为准
2. 与前后集之间的剧情要有连贯性${prevSynopsis ? '，本集开篇必须承接上一集的结尾，不能与上一集剧情矛盾' : ''}
3. 要合理安排几条故事线的节奏，几条故事线穿插进行
4. 第一集的开场和最后一集的钩子要对应上一步中的结果

请严格按以下格式输出：
标题：本集标题
开场钩子：一句话开场钩子
剧情简介：约300字剧情简介
关键场次：场次一、场次二、场次三
结尾钩子：一句话结尾钩子`;
}

/** Step5 → Step6（逐集分镜脚本，纯文本）。 */
export function buildScriptPrompt(p: {
  market: string;
  scriptLanguage: string;
  dialogueLanguage: string;
  durationMin: number;
  episodes: number;
  epNum: number;
  episode: { title: string | null; hook: string | null; synopsis: string | null};
  bible: { characters: ParsedCharacter[]; background: string; storyline: string };
  prevSynopsis?: string | null;
}): string {
  const marketLabel = MARKET_LABEL[p.market] ?? p.market;
  const scriptLang = p.scriptLanguage === 'en' ? '英文' : '中文';
  const dialogueLang = DIALOGUE_LABEL[p.dialogueLanguage] ?? '中文';
  const nameLang = p.scriptLanguage === 'en' ? '英语' : '中文';
  const secondsPerEp = Math.round((p.durationMin * 60) / p.episodes);
  const prevText = p.prevSynopsis ? `上一集（第 ${p.epNum - 1} 集）剧情回顾：「${p.prevSynopsis}」\n` : '';

  return `现在人物设定已确定如下：
「${charactersBlock(p.bible.characters)}」

背景设定已确定如下：
「${p.bible.background}」

现在分集大纲已确定，「第${p.epNum}集」的大纲内容如下：
「开篇钩子：${p.episode.hook ?? ''}
剧情大纲：${p.episode.synopsis ?? ''}」

${prevText}根据以上信息撰写该集的分镜脚本，要求：
1. 人物姓名、身份、家族/势力名必须与人物设定严格一致，禁止新增角色名、改名或混用；若剧情与人物设定冲突，以人物设定为准
2. 人物名、家族/势力名使用 ${nameLang}
3. 对话台词、画面字使用「${dialogueLang}」
4. 分镜脚本的其它内容均使用「${scriptLang}」
5. AI 生成视频时，对于手机屏幕/电脑屏幕/纸张等画面中的文字生成有难度，所以在分镜设计上尽量避免这样的画面，可以用画外音（心里默读）、角色口述或其他方式表现出来
6. 每集的篇幅长度一定要控制在 ${secondsPerEp} 秒左右
7. 该短剧要在「${marketLabel}」发布，注意进行「${marketLabel}」的本土化调整
8. 每集的节奏要紧凑，要按照大纲中每集的开篇钩子和结尾钩子作为每集开篇和结尾，中间内容要符合剧情简介，可以适当插入或调整内容，但前后剧情要连贯${p.prevSynopsis ? '，本集开篇必须承接上一集的结尾，不能与上一集剧情矛盾' : ''}
9. 台词要简洁精炼，符合短剧的快节奏要求
10. 分镜脚本中要有镜头语言提示，具体格式参考如下（直接输出纯文本，不要额外解释）：

第${p.epNum}集

${p.epNum}-1 场景名称/内外/日夜
人物：角色A、角色B
△（开场特写）场景描述动作说明。
角色A：（情绪）台词内容。
角色B：台词内容。
△动作描述继续。
角色A（os）：内心独白或画外音。`;
}

/** 修改意见重生成（§5.5）：在原 prompt 前附加修改上下文。 */
export function buildFeedbackPrompt(originalPrompt: string, feedback: string, currentContent: string): string {
  return `以下是当前已生成的内容：
「${currentContent}」

用户对以上内容有如下修改意见：
「${feedback}」

请根据修改意见，在保留原内容框架的基础上，对相应部分进行修改后重新输出完整内容（保持原来的输出格式）。

${originalPrompt}`;
}

/** Step2「AI推荐姓名」：针对当前角色姓名推荐 5 个备选名字。 */
export function buildNameRecommendPrompt(currentName: string): string {
  return `再给我推荐5个「${currentName}」的不同名字，并列出推荐理由（要求不超过100字）。

请严格按以下格式输出，每条占一行，字段之间用 | 分隔：
姓名|推荐理由
姓名|推荐理由
姓名|推荐理由
姓名|推荐理由
姓名|推荐理由

不要输出序号、标题或任何其他内容。`;
}
