export interface MockCharacter {
  id: string;
  name: string;
  role: string;
  gender: string;
  age: string;
  traits: string[];
  backstory: string;
  colorSeed: number;
}

export interface MockScriptScene {
  id: string;
  sceneHeading: string;
  location: string;
  timeOfDay: string;
  action: string;
  dialogue: { character: string; parenthetical?: string; line: string }[];
}

export interface MockProject {
  id: string;
  name: string;
  market: string;
  genre: string[];
  episodes: number;
  step: number;
  lastEdited: string;
  colorSeed: number;
  progress: number;
}

export const mockCharacters: MockCharacter[] = [
  {
    id: '1',
    name: '赵辰',
    role: '男主角',
    gender: '男',
    age: '28岁',
    traits: ['重生者', '腹黑', '实力强横', '隐忍'],
    backstory: '三百年后一代武帝重生于侯府旁支少年赵辰身上。前世被至亲背叛、含冤而死，今生他藏锋守拙，暗中布局，誓要打破命运枷锁，走出属于自己的帝王之路。表面废物，内心深处却是九天之上俯瞰众生的武道巅峰。',
    colorSeed: 0,
  },
  {
    id: '2',
    name: '林雪瑶',
    role: '女主角',
    gender: '女',
    age: '22岁',
    traits: ['大女主', '聪慧', '外柔内刚', '医术精湛'],
    backstory: '医仙传人，外表温柔如水，实则腹有乾坤。曾遭未婚夫退婚、家族落难，以一己之力重振林家。与赵辰相遇后，两人惺惺相惜，共同对抗权贵阴谋。她看穿了他深藏的秘密，也成为他今生唯一的软肋。',
    colorSeed: 1,
  },
  {
    id: '3',
    name: '赵天',
    role: '反派',
    gender: '男',
    age: '31岁',
    traits: ['表面宽厚', '心机深沉', '权欲熏心', '擅长伪装'],
    backstory: '赵辰同父异母的长兄，侯府继承人。前世亲手将赵辰推入深渊，今生却浑然不知对方已携三百年记忆归来。他拉拢各方势力，意图架空父侯，最终夺取整个侯府乃至更大的权柄。笑容之下藏着最深的毒蛇之心。',
    colorSeed: 2,
  },
  {
    id: '4',
    name: '宋青云',
    role: '男配角',
    gender: '男',
    age: '26岁',
    traits: ['义气', '武痴', '直率', '忠心耿耿'],
    backstory: '赵辰今生的发小与挚友，出身江湖草莽，一身横练功夫打磨得虎背熊腰。对于赵辰突然的"觉醒"半信半疑，却无条件选择站在他身边。是赵辰在侯府中最信任的左膀右臂。',
    colorSeed: 3,
  },
];

export const mockBackground = `故事发生于一个架空大陆「苍穹界」，修炼文明与武道并行，神脉觉醒是每位武者踏入强者之路的关键。大陆分五大王朝，天武王朝为其一，内有七大侯府把持朝堂。

赵家所在的镇北侯府虽贵为七侯之列，却因老侯爷赵风年迈体衰而暗流涌动，各方势力蠢蠢欲动。城中的神脉大典每三年一届，凡年满十五的侯府子弟皆须参与，神脉等级决定一生命运。

整个大陆以神脉境为基础修炼体系：炼体期 → 凝脉期 → 开脉期 → 通脉期 → 聚元期 → 化神期，化神期之上则是传说中的武帝境。赵辰前世登临武帝之巅，三百年后重生，神脉尚未觉醒，一切从零开始。`;

export const mockStoryline = `【主线】废物少爷逆袭称帝线
赵辰以"废物"身份隐忍蛰伏，借前世记忆迅速恢复实力，在每一次被轻视、被打压时悄然积累底牌，最终以雷霆之势反杀所有算计他的人，重登武帝宝座。

【感情线】赵辰 × 林雪瑶
两人初识时赵辰救雪瑶于危难，雪瑶以医术报恩，在治疗中察觉赵辰脉象隐藏的惊天秘密。从相互试探到坦诚相待，感情线穿插于逆袭线中，雪瑶成为赵辰最重要的精神支柱。

【副线A】侯府夺权线
赵天步步为营，拉拢朝中势力，意图在老侯爷归天前完成布局。赵辰则暗中化解每一次针对父亲与自己的阴谋，兄弟间的博弈成为贯穿全剧的暗战。

【副线B】神脉秘密线
大陆上神脉觉醒本是天命，但赵辰发现其中存在人为操控的黑幕，觉醒等级竟可被权贵购买与压制。揭开这一秘密，将动摇整个天武王朝的根基。`;

export const mockSegments = [
  { id: '1', title: '第一段', range: '第 1–20 集', hook: '废物少爷神脉觉醒，震惊侯府众人', ending: '赵辰在暗中击败强敌，身份秘密面临暴露', summary: '赵辰以重生者身份初步适应少年身躯，在神脉大典上以惊天之姿完成觉醒。表面维持废物形象，暗中迅速夯实修炼根基。结识林雪瑶，初探侯府权力暗流。赵天的第一次针对被悄然化解，留下伏笔。' },
  { id: '2', title: '第二段', range: '第 21–40 集', hook: '林雪瑶发现赵辰秘密，两人结成同盟', ending: '赵天联合外敌发动突袭，赵辰被迫现出部分实力', summary: '赵辰在林雪瑶意外发现其修为端倪后，两人达成攻守同盟。赵辰开始主动出击，逐步拆解赵天在朝中布置的棋子。宋青云在一次生死危机中彻底成为赵辰的绝对心腹。第一次正面交锋，赵辰以化神初期修为震慑全场，名声初显。' },
  { id: '3', title: '第三段', range: '第 41–60 集', hook: '神脉黑幕浮出水面，赵辰开始逆查', ending: '老侯爷重病，侯府危机全面爆发', summary: '神脉操控真相的调查进入关键阶段，赵辰发现幕后黑手与朝中重臣勾连。赵天感受到威胁，加快夺权布局，兄弟间的暗战全面升级。林雪瑶险遭暗算，赵辰为救她曝光更多实力，引发各方重新估量。老侯爷突然病重，侯府大乱。' },
  { id: '4', title: '第四段', range: '第 61–80 集', hook: '赵辰公开挑战赵天，侯府天翻地覆', ending: '赵辰登临武帝，俯瞰苍穹大陆', summary: '赵辰公开摊牌，以碾压性实力击败赵天及其所有盟友，神脉黑幕被彻底揭露，朝堂震荡。老侯爷在弥留之际得知真相，赵辰为其报仇雪恨。最终一战，赵辰突破武帝境，赵天覆灭，林雪瑶与赵辰携手并肩，大结局。' },
];

export const mockEpisodeSynopses = [
  { id: '1', episode: 1, title: '废物重生', hook: '神脉大典在即，废物少爷赵辰睁开了不属于这个年纪的眼睛', synopsis: '镇北侯府演武场，众人嘲笑十五岁仍未觉醒神脉的赵辰。赵辰内心独白揭示真相——他是三百年后武帝重生。默默观察侯府现状，暗中制定蛰伏计划，同时开始秘密修炼以恢复前世底子。与林雪瑶的第一次相遇，互不知底细。', keyScenes: ['演武场嘲讽开场', '赵辰内心独白重生揭秘', '秘密修炼第一幕'] },
  { id: '2', episode: 2, title: '神脉大典', hook: '全侯府屏息以待，废物的命运即将揭晓', synopsis: '神脉大典正式开始，赵辰故意压制显露的神脉等级，仅显示一阶低品，引发全场哄笑。私下里，赵辰发现神脉评测装置中有人动了手脚。林雪瑶作为医仙传人出席大典，在人群中注意到赵辰异常平静的眼神。', keyScenes: ['神脉大典开幕仪式', '赵辰故意压制神脉', '林雪瑶初次留意'] },
  { id: '3', episode: 3, title: '暗流初现', hook: '侯府宴会上，笑声背后藏着刀', synopsis: '老侯爷设宴，赵天意气风发主持宴席，借机羞辱赵辰。赵辰隐忍受辱，暗中观察赵天势力分布。宋青云在席间为赵辰出头，反被围殴，赵辰出手救援却故意留有余地，维持废物人设。宴后，赵辰开始暗中搜集赵天结党的证据。', keyScenes: ['侯府宴会全景', '赵天当众羞辱', '赵辰出手救宋青云'] },
  { id: '4', episode: 4, title: '医仙传人', hook: '一次意外的救援，两个秘密的人相遇', synopsis: '林雪瑶出城采药遭遇歹徒袭击，赵辰恰好路过出手相救，刻意隐藏了真实实力。林雪瑶在为赵辰把脉时发现其经脉中有极为罕见的武帝残留气息，陷入怀疑。赵辰察觉，两人开始了试探性的对话。', keyScenes: ['野外遭遇战', '林雪瑶把脉发现异常', '两人初次深谈'] },
  { id: '5', episode: 5, title: '底牌初显', hook: '夜袭！有人要置赵辰于死地', synopsis: '赵天派出刺客夜袭赵辰院落。赵辰以聚元期实力轻松处理，留下一名刺客活口审讯。发现刺客来自城中黑市势力，疑与赵天勾连。销毁证据、假装受伤，次日以"被人所救"的说辞瞒过众人。宋青云对赵辰的真实身份愈发起疑。', keyScenes: ['刺客夜袭', '赵辰真实实力初现', '赵辰伪装受伤瞒众人'] },
];

export const mockScriptScenes: MockScriptScene[] = [
  {
    id: '1-1',
    sceneHeading: '1-1  王侯府演武场 / 外 / 日',
    location: '王侯府演武场',
    timeOfDay: '日',
    action: '（开场特写）赵辰盘腿坐在角落，一身破旧粗布衣。周围的锦衣侯府子弟正在指指点点，窃窃私语。演武场中央，十数名同龄子弟正在展示神脉，五色光芒此起彼伏，引得看台观众阵阵喝彩。',
    dialogue: [
      { character: '周围子弟 A', parenthetical: '嘲弄', line: '15 岁都没觉醒神脉，怎么还敢来演武场丢人现眼？' },
      { character: '周围子弟 B', line: '真不知道侯爷英勇一生，怎么生出这种废物。' },
      { character: '赵辰', parenthetical: 'OS', line: '废物？呵。谁能想到，三百年后，我这堂堂一代武帝，竟会重生在一个同名同姓的侯府旁支身上。' },
    ],
  },
  {
    id: '1-2',
    sceneHeading: '1-2  王侯府演武场 / 外 / 日（续）',
    location: '王侯府演武场',
    timeOfDay: '日',
    action: '赵辰猛地睁开眼，眼神中闪过一丝不属于这个年纪的冷酷与沧桑。他缓缓站起身，拍了拍衣上的灰尘，视线扫过嘲笑他的人群，嘴角微微上扬。',
    dialogue: [
      { character: '赵天', parenthetical: '走近，皮笑肉不笑', line: '二弟，今日大典你也来了？也好，让大家见见你……' },
      { character: '赵辰', parenthetical: '平静', line: '大哥，我来学习学习，观摩一下各位兄弟的神脉品阶。' },
      { character: '旁观者 C', parenthetical: '小声', line: '就他那副德行，学习？怕是来丢人的。' },
    ],
  },
  {
    id: '1-3',
    sceneHeading: '1-3  王侯府内院回廊 / 内 / 日',
    location: '王侯府内院回廊',
    timeOfDay: '日',
    action: '赵辰独自走在回廊中，四下无人。他驻足，伸出右手，掌心有一抹极淡的光晕闪现，随即收敛。三百年武帝底蕴，深藏在这副瘦弱的少年躯体之中。',
    dialogue: [
      { character: '赵辰', parenthetical: 'OS', line: '前世被天道轮转送回此处，定有其因。赵天……你等着，这一世，我不会再给你机会。' },
      { character: '林雪瑶', parenthetical: '不期而遇，疑惑', line: '这位公子，你手掌方才那道光……' },
      { character: '赵辰', parenthetical: '迅速收敛，回头，淡淡一笑', line: '姑娘看错了，不过是日光折射。' },
    ],
  },
  {
    id: '1-4',
    sceneHeading: '1-4  王侯府议事厅 / 内 / 日',
    location: '王侯府议事厅',
    timeOfDay: '日',
    action: '老侯爷赵风端坐主位，须发皆白，气度沉凝。赵天立于侧旁，一众幕僚侍立左右。赵辰踏入，众人目光齐刷刷扫来。',
    dialogue: [
      { character: '赵风', parenthetical: '缓缓', line: '辰儿，今日大典，你参加了？' },
      { character: '赵辰', line: '回父亲，孩儿去看了看，长长见识。' },
      { character: '赵天', parenthetical: '意有所指', line: '父亲，二弟神脉迟迟未开，不若请名医来调理一番？' },
      { character: '赵辰', parenthetical: '低头，语气谦和', line: '多谢大哥费心，孩儿不碍事的。' },
    ],
  },
];

export const mockProjects: MockProject[] = [
  { id: '1', name: '重生武帝：从废物少爷到一代帝尊', market: '中国', genre: ['重生', '战神/龙王', '修仙玄幻'], episodes: 80, step: 6, lastEdited: '2026-08-17', colorSeed: 0, progress: 75 },
  { id: '2', name: '霸总的失忆甜妻', market: '中国', genre: ['霸总', '甜宠', '闪婚契约'], episodes: 40, step: 3, lastEdited: '2026-08-15', colorSeed: 1, progress: 38 },
  { id: '3', name: 'The Alpha\'s Forbidden Mate', market: '欧美', genre: ['狼人/吸血鬼', '隐藏身份', '先婚后爱'], episodes: 60, step: 2, lastEdited: '2026-08-12', colorSeed: 2, progress: 22 },
];

const OVERSEAS_GENRES = ['狼人/吸血鬼', '霸总', '大女主', '甜宠', '隐藏身份', '先婚后爱', '复仇', '逆袭', '穿越', '重生', '身份互换', '追妻火葬场', '萌宝', 'LGBT'];

export const GENRE_OPTIONS: Record<string, string[]> = {
  global: OVERSEAS_GENRES,   // 欧美
  latam: OVERSEAS_GENRES,    // 拉美
  china: ['赘婿', '战神/龙王', '修仙玄幻', '逆袭', '历史古代', '权谋', '系统流', '大女主', '霸总', '甜宠', '萌宝', '重生', '穿越', '真假千金', '闪婚契约', '复仇', '虐恋情深', '女帝/王妃', '替身/白月光'],
};

export const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #6C5CE7, #a29bfe)',
  'linear-gradient(135deg, #0984E3, #74b9ff)',
  'linear-gradient(135deg, #E17055, #fab1a0)',
  'linear-gradient(135deg, #00B894, #55efc4)',
  'linear-gradient(135deg, #FDCB6E, #ffeaa7)',
  'linear-gradient(135deg, #fd79a8, #e84393)',
];
