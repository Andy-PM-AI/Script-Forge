# ScriptForge — 功能设计与代码设计说明文档

> 本文档描述 ScriptForge 短剧剧本 AI 创作工具的完整设计方案，供 Claude Code 实现服务端、数据库及 API 层时参考。前端已完成，本文档重点阐述数据模型、API 接口、AI 调用链路及工程架构。

---

## 目录

1. [产品概述](#1-产品概述)
2. [整体架构](#2-整体架构)
3. [数据模型（数据库设计）](#3-数据模型)
4. [API 接口设计](#4-api-接口设计)
5. [AI 调用链路设计](#5-ai-调用链路设计)
6. [7步工作流详细说明](#6-7步工作流详细说明)
7. [用户认证与权限](#7-用户认证与权限)
8. [文件导出服务](#8-文件导出服务)
9. [前端对接说明](#9-前端对接说明)
10. [推荐技术栈](#10-推荐技术栈)
11. [环境变量清单](#11-环境变量清单)

---

## 1. 产品概述

**ScriptForge** 是一款面向短剧创作者的 AI 辅助剧本生成平台。用户通过 **7 步向导式工作流**，从项目基础设定出发，逐步生成人物设定、背景设定、故事线、分段大纲、分集大纲、分集脚本，直至最终的分镜脚本，并支持多格式导出。

### 核心特性

- 每一步均支持 **AI 生成 + 用户原地编辑 + 输入修改意见重生成** 三种工作模式
- AI 生成采用 **层级 Prompt 链**：下游步骤的 Prompt 自动包含上游已确认内容
- 集数 ≤ 40 时，第三步（分段粗纲）和第四步（分集粗纲）**自动跳过**
- 分镜脚本支持 **逐集按需生成**，支持暂停/继续

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React + Vite)                   │
│  Home → Step1 → Step2 → Step3* → Step4* → Step5 → Step6 → Step7 │
│  (* 集数≤40时跳过)                                            │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS / REST + SSE
┌───────────────────────▼─────────────────────────────────────┐
│                      后端 API Server                          │
│  - 用户认证 (JWT)                                             │
│  - 项目 CRUD                                                  │
│  - 7步工作流数据 CRUD                                         │
│  - AI 调用代理（Prompt 拼装 + Claude API 调用 + 流式返回）     │
│  - 文件导出服务 (PDF / Word / 飞书)                            │
└──────────┬────────────────────────┬────────────────────────-┘
           │                        │
┌──────────▼──────────┐   ┌────────▼──────────────────────────┐
│      数据库           │   │         外部服务                   │
│  PostgreSQL          │   │  - Anthropic Claude API           │
│  - users             │   │  - 飞书开放平台 API                 │
│  - projects          │   │  - 对象存储 (导出文件缓存)           │
│  - project_steps     │   └───────────────────────────────────┘
│  - characters        │
│  - segments          │
│  - episode_groups    │
│  - episodes          │
│  - scripts           │
└─────────────────────┘
```

---

## 3. 数据模型

### 3.1 用户表 `users`

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),              -- 邮箱登录时使用
  oauth_provider VARCHAR(50),             -- 'github' | 'google' | null
  oauth_id      VARCHAR(255),
  display_name  VARCHAR(100),
  avatar_url    VARCHAR(500),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 项目表 `projects`

```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL DEFAULT '新剧本项目',

  -- 基础设定（第一步输入）
  market          VARCHAR(20) NOT NULL,   -- 'china' | 'global' | 'latam'
  genres          TEXT[] NOT NULL DEFAULT '{}',
  episodes        SMALLINT NOT NULL DEFAULT 80,  -- 20~100
  duration_min    SMALLINT NOT NULL DEFAULT 80,  -- 总时长（分钟）
  script_language VARCHAR(5) NOT NULL DEFAULT 'zh',    -- 'zh' | 'en'
  dialogue_language VARCHAR(10) NOT NULL DEFAULT 'zh', -- 'zh' | 'en-zh' | 'en'
  synopsis        TEXT,
  color_seed      SMALLINT DEFAULT 0,     -- 封面颜色（0~5）

  -- 当前进度
  current_step    SMALLINT NOT NULL DEFAULT 1,  -- 1~7，已到达的最高步骤
  status          VARCHAR(20) DEFAULT 'draft',  -- 'draft' | 'completed'

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
```

### 3.3 人物表 `characters`

对应第一步的「人物小传」输入，以及第二步 AI 生成后的「人物设定」结果。

```sql
CREATE TABLE characters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source        VARCHAR(20) NOT NULL, -- 'user_input' | 'ai_generated'
  name          VARCHAR(100) NOT NULL,
  gender        VARCHAR(10),          -- 'male' | 'female' | 'other'
  age           VARCHAR(20),          -- 存储为文本，如 '28岁' 或 'late 20s'
  role          VARCHAR(50),          -- '男主角' | '女主角' | '反派' | '配角' 等
  is_protagonist BOOLEAN DEFAULT false,
  traits        TEXT[],              -- 性格特点标签列表
  description   TEXT,                -- 人物介绍（user_input时）
  backstory     TEXT,                -- 经历介绍（ai_generated时）
  sort_order    SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_characters_project_id ON characters(project_id);
```

### 3.4 第二步生成结果表 `step2_results`

```sql
CREATE TABLE step2_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  background    TEXT,     -- 背景设定（世界观/时代背景）
  storyline     TEXT,     -- 故事线（主线+副线+感情线）
  ai_version    SMALLINT DEFAULT 1,   -- AI 重生成次数
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 分段粗纲表 `segments`（第三步）

```sql
CREATE TABLE segments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order    SMALLINT NOT NULL,    -- 段落顺序，从 1 开始
  title         VARCHAR(50),          -- '第一段'
  episode_start SMALLINT NOT NULL,    -- 该段起始集数
  episode_end   SMALLINT NOT NULL,    -- 该段结束集数
  hook          TEXT,                 -- 开场钩子
  summary       TEXT,                 -- 剧情简介（约1000字）
  ending_hook   TEXT,                 -- 结尾钩子
  status        VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'generating' | 'done'
  ai_version    SMALLINT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_segments_project_id ON segments(project_id);
```

**分段规则**（由后端在创建项目后计算）：

| 集数 | 分段方式 |
|------|---------|
| ≤ 40 | 跳过此步 |
| 50 | 每10集一段 → 5段 |
| 60 | 每15集一段 → 4段 |
| 70 | 每14集一段 → 5段 |
| 80 | 每20集一段 → 4段 |
| 90 | 每15集一段 → 6段 |
| 100 | 每20集一段 → 5段 |

### 3.6 分集粗纲表 `episode_groups`（第四步）

```sql
CREATE TABLE episode_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  segment_id    UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  sort_order    SMALLINT NOT NULL,
  label         VARCHAR(50),          -- '第1小段'
  episode_start SMALLINT NOT NULL,
  episode_end   SMALLINT NOT NULL,
  hook          TEXT,
  summary       TEXT,
  ending_hook   TEXT,
  status        VARCHAR(20) DEFAULT 'pending',
  ai_version    SMALLINT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_episode_groups_project_id ON episode_groups(project_id);
CREATE INDEX idx_episode_groups_segment_id ON episode_groups(segment_id);
```

### 3.7 分集脚本表 `episodes`（第五步）

```sql
CREATE TABLE episodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_number SMALLINT NOT NULL,   -- 第几集，1-indexed
  title         VARCHAR(100),          -- 集标题
  hook          TEXT,                  -- 开场钩子
  synopsis      TEXT,                  -- 剧情大纲（约1000字）
  key_scenes    TEXT[],                -- 关键场次列表
  status        VARCHAR(20) DEFAULT 'pending',
  ai_version    SMALLINT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, episode_number)
);

CREATE INDEX idx_episodes_project_id ON episodes(project_id);
```

### 3.8 分镜脚本表 `scripts`（第六步）

```sql
CREATE TABLE scripts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id     UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  episode_number SMALLINT NOT NULL,
  content        TEXT,                -- 剧本全文（纯文本，见§6.6格式规范）
  status         VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'generating' | 'done'
  ai_version     SMALLINT DEFAULT 1,
  word_count     INT,                 -- 字数统计（保存时计算）
  scene_count    SMALLINT,            -- 场次数量（解析后更新）
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, episode_number)
);

CREATE INDEX idx_scripts_project_id ON scripts(project_id);
```

### 3.9 AI 操作历史表 `ai_feedback_history`

```sql
CREATE TABLE ai_feedback_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  step        SMALLINT NOT NULL,         -- 1~6，哪一步产生的
  target_type VARCHAR(50),               -- 'characters' | 'background' | 'storyline' | 'segment' | 'episode_group' | 'episode' | 'script'
  target_id   UUID,                      -- 对应记录的 ID（可为 null，代表整步）
  feedback    TEXT NOT NULL,             -- 用户输入的修改意见
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_project ON ai_feedback_history(project_id);
```

---

## 4. API 接口设计

基础路径：`/api/v1`

认证方式：`Authorization: Bearer <JWT>`

### 4.1 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | 邮箱注册 |
| POST | `/auth/login` | 邮箱登录，返回 JWT |
| POST | `/auth/refresh` | 刷新 token |
| GET  | `/auth/me` | 获取当前用户信息 |

### 4.2 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/projects` | 获取当前用户所有项目（支持分页、搜索、市场筛选、排序） |
| POST   | `/projects` | 创建项目（第一步提交时调用） |
| GET    | `/projects/:id` | 获取项目完整信息 |
| PATCH  | `/projects/:id` | 更新项目基础信息 |
| DELETE | `/projects/:id` | 删除项目 |

**GET /projects 查询参数：**
```
?search=霸总           -- 按项目名搜索
&market=china          -- 按市场筛选
&page=1&limit=12       -- 分页
&sort=updated_at|created_at|name
&order=desc|asc
```

**POST /projects 请求体：**
```json
{
  "name": "霸总爱上小秘书",
  "market": "china",
  "genres": ["霸总", "甜宠"],
  "episodes": 80,
  "duration_min": 80,
  "script_language": "zh",
  "dialogue_language": "zh",
  "synopsis": "...",
  "characters": [
    {
      "name": "陆晨曦",
      "gender": "male",
      "is_protagonist": true,
      "description": "霸道总裁..."
    }
  ]
}
```

**响应体（项目详情）：**
```json
{
  "id": "uuid",
  "name": "...",
  "market": "china",
  "genres": ["霸总"],
  "episodes": 80,
  "duration_min": 80,
  "script_language": "zh",
  "dialogue_language": "zh",
  "synopsis": "...",
  "current_step": 1,
  "status": "draft",
  "color_seed": 2,
  "created_at": "2026-08-19T10:00:00Z",
  "updated_at": "2026-08-19T10:00:00Z"
}
```

### 4.3 第二步：人物设定 / 背景设定 / 故事线

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/projects/:id/step2` | 获取第二步所有数据（角色列表 + background + storyline） |
| POST   | `/projects/:id/step2/generate` | **触发AI生成**（SSE流式）|
| PATCH  | `/projects/:id/characters/:charId` | 修改单个角色字段 |
| PATCH  | `/projects/:id/step2/background` | 修改背景设定 |
| PATCH  | `/projects/:id/step2/storyline` | 修改故事线 |
| POST   | `/projects/:id/step2/feedback` | 提交修改意见（记录+触发重生成，SSE流式） |

**POST /step2/generate 请求体：**
```json
{
  "target": "all"   -- "all" | "characters" | "background" | "storyline"
}
```

**POST /step2/feedback 请求体：**
```json
{
  "target": "characters",  -- "characters" | "background" | "storyline"
  "target_id": null,       -- 如针对具体角色，传角色 UUID
  "feedback": "让女主更强势一些，有自己的事业…"
}
```

### 4.4 第三步：分段粗纲

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/projects/:id/segments` | 获取所有段落列表（含状态） |
| POST   | `/projects/:id/segments/generate` | **触发全部段落AI生成**（SSE流式，逐段推送） |
| POST   | `/projects/:id/segments/:segId/generate` | 重新生成单个段落 |
| PATCH  | `/projects/:id/segments/:segId` | 修改段落内容 |
| POST   | `/projects/:id/segments/:segId/feedback` | 针对段落提交修改意见 |

### 4.5 第四步：分集粗纲

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/projects/:id/episode-groups` | 获取所有分集粗纲（两级结构） |
| POST   | `/projects/:id/episode-groups/generate` | 触发全部AI生成（SSE） |
| POST   | `/projects/:id/episode-groups/:groupId/generate` | 重新生成单个小段 |
| PATCH  | `/projects/:id/episode-groups/:groupId` | 修改内容 |
| POST   | `/projects/:id/episode-groups/:groupId/feedback` | 提交修改意见 |

### 4.6 第五步：分集脚本（每集大纲）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/projects/:id/episodes` | 获取所有集大纲列表 |
| GET    | `/projects/:id/episodes/:epNum` | 获取单集大纲 |
| POST   | `/projects/:id/episodes/generate` | 触发全部集大纲生成（SSE） |
| POST   | `/projects/:id/episodes/:epNum/generate` | 重新生成单集大纲 |
| PATCH  | `/projects/:id/episodes/:epNum` | 修改单集大纲内容 |
| POST   | `/projects/:id/episodes/:epNum/feedback` | 提交修改意见 |

### 4.7 第六步：分镜脚本

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/projects/:id/scripts` | 获取所有集脚本列表（含状态，不含 content） |
| GET    | `/projects/:id/scripts/:epNum` | 获取单集完整脚本内容 |
| POST   | `/projects/:id/scripts/generate` | 开始生成所有集（SSE，逐集推送） |
| POST   | `/projects/:id/scripts/:epNum/generate` | 重新生成单集脚本（SSE） |
| PATCH  | `/projects/:id/scripts/:epNum` | 保存用户手动编辑后的内容 |
| POST   | `/projects/:id/scripts/:epNum/feedback` | 提交修改意见 |

### 4.8 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/projects/:id/export/pdf` | 导出 PDF，返回下载链接 |
| POST | `/projects/:id/export/word` | 导出 Word(.docx)，返回下载链接 |
| POST | `/projects/:id/export/feishu` | 导出到飞书文档，返回飞书文档链接 |

**导出请求体（PDF/Word）：**
```json
{
  "scope": "all",          -- "all" | "episode"
  "episode_number": null   -- scope="episode" 时传具体集数
}
```

---

## 5. AI 调用链路设计

### 5.1 AI 模型选型

推荐使用 **Claude claude-sonnet-5**（`claude-sonnet-5`）作为主模型：
- 中文创作质量高
- 支持长输出（分镜脚本单集可达 3000+ tokens）
- 支持流式输出（SSE）

### 5.2 SSE 流式响应规范

所有触发 AI 生成的接口均使用 **Server-Sent Events（SSE）** 流式返回，前端通过 `EventSource` 或 `fetch` + `ReadableStream` 接收。

**SSE 事件类型：**

```
event: start
data: {"step": 3, "total": 4}

event: chunk
data: {"segment_id": "uuid", "index": 1, "delta": "剧情正在..."}

event: done
data: {"segment_id": "uuid", "index": 1, "content": "完整内容..."}

event: progress
data: {"completed": 2, "total": 4}

event: error
data: {"code": "AI_ERROR", "message": "生成失败，请重试"}

event: finish
data: {"completed": 4, "total": 4}
```

### 5.3 Prompt 构建模块

后端需实现 `PromptBuilder` 类，按步骤从数据库读取上游数据拼装 Prompt。

#### Step 1 → Step 2 Prompt

```python
def build_step2_prompt(project) -> str:
    market_label = {"china": "中国", "global": "欧美", "latam": "拉美"}[project.market]
    genre_label = "、".join(project.genres)
    
    chars_text = "\n".join([
        f"{c.name}（{'男' if c.gender=='male' else '女'}，{'主角' if c.is_protagonist else '配角'}）：{c.description or '无介绍'}"
        for c in project.characters
    ]) or "（未填写）"
    
    return f"""你现在是最资深最有才华且写出过「{market_label}」大爆款的短剧编剧。
我准备要做一部面向「{market_label}」的AI仿真人短剧，故事题材属于「{genre_label}」，全剧共「{project.episodes}」集，总时长「{project.duration_min}」分钟。
故事梗概如下：「{project.synopsis or '（未填写）'}」
人物小传如下：「{chars_text}」
根据以上信息，先帮我生成完整的人物设定、背景设定和故事线，要求如下：
1. 如果有角色还没有确定的姓名时，可以根据剧情给该角色起一个合适的名字
2. 如果人物小传和故事梗概存在不一致时，以人物小传为准
3. 生成人物设定时，如果有人物小传中没列出的重要角色，可以新增
4. 人物设定按照以下格式生成：角色姓名、角色年龄、角色身份（男主/女主/女配/反派等）、性格特点、经历介绍"""
```

#### Step 2 → Step 3 Prompt（分段粗纲）

分段大小由后端根据 `episodes` 计算：

```python
def get_segment_size(episodes: int) -> str:
    if episodes <= 50:  return "10集"
    if episodes <= 60:  return "15集"
    if episodes <= 70:  return "14集"
    if episodes <= 90:  return "15集"
    return "20集"  # 80, 100集

def build_step3_prompt(project, step2_result, characters) -> str:
    seg_size = get_segment_size(project.episodes)
    chars_text = "\n\n".join([
        f"{c.name}（{c.age}，{c.role}）\n性格：{'、'.join(c.traits)}\n经历：{c.backstory}"
        for c in characters
    ])
    return f"""现在人物设定已确定如下：
「{chars_text}」
背景设定已确定如下：
「{step2_result.background}」
故事线已确定如下：
「{step2_result.storyline}」
全剧共「{project.episodes}」集，总时长「{project.duration_min}」分钟。
根据以上信息先确定剧情大纲，以「{seg_size}」为一段，列出每段的剧情简介（1000 左右）、每段的开场和结尾钩子，要求：
1. 每段之间的剧情要有连贯性
2. 要合理安排几条故事线的节奏，不能一直讲某条线而其他线不提，需要几条故事线穿插进行
3. 遇到人物设定、背景设定、故事线之间的信息不一致时，优先以人物设定为准，其次为背景设定，最后是故事线"""
```

#### Step 3 → Step 4 Prompt（分集粗纲，逐段生成）

```python
def build_step4_prompt(segment) -> str:
    return f"""现在分段大纲已确定，「{segment.title}」的大纲内容如下：
「剧情简介：{segment.summary}
开篇钩子：{segment.hook}
结尾钩子：{segment.ending_hook}」
根据以上信息，以「5集」为一段，列出每段的剧情简介（1000 左右）、每段的开场和结尾钩子，要求：
1. 每段之间的剧情要有连贯性
2. 要合理安排几条故事线的节奏，不能一直讲某条线而其他线不提，需要几条故事线穿插进行
3. 第一段的开场和最后一段的钩子要对应上一步中的结果"""
```

#### Step 4/3 → Step 5 Prompt（分集脚本大纲，逐集生成）

集数 ≤ 40 时从第三步（segments）直接生成；集数 > 40 时从第四步（episode_groups）生成。

```python
def build_step5_prompt(episode_group_or_segment, episode_number) -> str:
    return f"""现在分段大纲已确定，「第{episode_number}集所在段落」的大纲内容如下：
「剧情简介：{episode_group_or_segment.summary}
开篇钩子：{episode_group_or_segment.hook}
结尾钩子：{episode_group_or_segment.ending_hook}」
根据以上信息，列出每1集的剧情简介（1000 左右）、每集的开场和结尾钩子，要求：
1. 每集之间的剧情要有连贯性
2. 要合理安排几条故事线的节奏，不能一直讲某条线而其他线不提，需要几条故事线穿插进行
3. 第一集的开场和最后一集的钩子要对应上一步中的结果"""
```

#### Step 5 → Step 6 Prompt（分镜脚本，逐集生成）

这是最关键的 Prompt，包含完整的格式示例：

```python
def build_step6_prompt(project, episode) -> str:
    market_label = {"china": "中国", "global": "欧美", "latam": "拉美"}[project.market]
    script_lang = "英文" if project.script_language == "en" else "中文"
    dialogue_lang_map = {"zh": "中文", "en": "英文", "en-zh": "英（主）中（辅）"}
    dialogue_lang = dialogue_lang_map[project.dialogue_language]
    name_lang = "英语" if project.script_language == "en" else "中文"
    seconds_per_ep = round(project.duration_min * 60 / project.episodes)

    return f"""现在分集大纲已确定，「第{episode.episode_number}集」的大纲内容如下：
「开篇钩子：{episode.hook}
剧情大纲：{episode.synopsis}」
根据以上信息撰写该集的分镜脚本，要求：
1. 人物名、家族/势力名使用 {name_lang}
2. 对话台词、画面字使用「{dialogue_lang}」
3. 分镜脚本的其它内容均使用「{script_lang}」
4. AI 生成视频时，对于手机屏幕 / 电脑屏幕 / 纸张等画面中的文字生成有难度，所以在分镜设计上尽量避免这样的画面，可以用画外音（心里默读）、角色口述或其他方式表现出来。
5. 每集的篇幅长度一定要控制在 {seconds_per_ep} 秒左右。
6. 该短剧要在「{market_label}」发布，注意进行「{market_label}」的本土化调整。
7. 每集的节奏要紧凑，要按照大纲中每集的开篇钩子和结尾钩子作为每集开篇和结尾，中间内容要符合剧情简介，可以适当插入或调整内容，但前后剧情要连贯。
8. 台词要简洁精炼，符合短剧的快节奏要求。
9. 分镜脚本中要有镜头语言提示，具体格式参考如下：

第{episode.episode_number}集
{episode.episode_number}-1 场景名称/内外/日夜
人物：角色A、角色B
△（开场特写）场景描述动作说明。
角色A：（情绪）台词内容。
角色B：台词内容。
△动作描述继续。
角色A（os）：内心独白或画外音。"""
```

### 5.4 AI 响应解析

**Step 2 响应解析**：AI 返回的内容需要解析为结构化数据。推荐在 Prompt 中要求 AI 以特定分隔符输出：

```
在 Step 2 的 Prompt 末尾追加：
"请按以下格式输出，用 [SECTION:xxx] 标记各部分：
[SECTION:CHARACTERS]
...人物设定内容...
[SECTION:BACKGROUND]
...背景设定内容...
[SECTION:STORYLINE]
...故事线内容..."
```

**Step 3/4/5 响应解析**：类似地用分隔符标记各段落。

**Step 6**：分镜脚本为纯文本，直接存储，无需解析。

### 5.5 修改意见重生成

当用户提交修改意见时，在对应步骤的 Prompt 前附加修改上下文：

```python
def build_feedback_prompt(original_prompt, feedback, current_content) -> str:
    return f"""以下是当前已生成的内容：
「{current_content}」

用户对以上内容有如下修改意见：
「{feedback}」

请根据修改意见，在保留原内容框架的基础上，对相应部分进行修改后重新输出完整内容。

{original_prompt}"""
```

---

## 6. 7步工作流详细说明

### 6.1 第一步：项目基础设定

**触发时机**：用户点击「确认提交，下一步」。

**后端操作**：
1. 创建 `projects` 记录
2. 批量创建 `characters` 记录（source='user_input'）
3. 根据 `episodes` 预计算并创建 `segments` 占位记录（status='pending'）
4. 如 `episodes > 40`，同时创建 `episode_groups` 占位记录
5. 创建 `episodes` 占位记录（status='pending'）× N 集
6. 返回创建好的 project_id

### 6.2 第二步：人物设定 / 背景设定 / 故事线

**触发时机**：进入页面后自动触发（或用户点击「重新生成」）。

**后端操作**：
1. 读取 project + characters（user_input）
2. 调用 Claude API（流式），同时更新 SSE 推送
3. 解析 AI 响应，分别更新/创建 `characters`（source='ai_generated'）、`step2_results.background`、`step2_results.storyline`
4. 更新 `projects.current_step = 2`

**字段级编辑**：前端调用 `PATCH /projects/:id/characters/:charId`，后端直接更新对应字段。

### 6.3 第三步：分段粗纲（集数 > 40 时生效）

**触发时机**：进入页面后自动开始逐段生成。

**后端操作**（逐段串行）：
1. 读取 step2 数据构建 Prompt
2. 对每个 segment 依次调用 Claude，SSE 推送 `event:done` 携带完整内容
3. 更新 `segments.status = 'done'`
4. 全部完成后更新 `projects.current_step = 3`

**分段大小**：由 `get_segment_size(episodes)` 函数确定（见 §5.3）。

### 6.4 第四步：分集粗纲（集数 > 40 时生效）

类似第三步，以 segment 为单位，每个 segment 下生成对应的 episode_groups。

### 6.5 第五步：分集脚本（每集大纲）

**触发时机**：进入页面后自动逐集生成。

**后端操作**：
- 集数 ≤ 40：从 `segments` 读上下文
- 集数 > 40：从 `episode_groups` 读上下文
- 逐集调用 Claude，SSE 推送

### 6.6 第六步：分镜脚本

**脚本纯文本格式规范**（必须严格遵守，前端解析依赖此格式）：

```
第N集

N-1 场景名称/内外景/日夜
人物：角色A、角色B
△（场景描述标注）动作说明文字
角色A：（情绪括号可选）台词内容
角色B（os）：旁白或内心独白
△动作继续描述

N-2 场景名称/内外景/日夜
...
```

**解析规则**（前端 `ScriptReadView` 使用，后端统计时同样适用）：

| 行类型 | 识别规则 |
|--------|---------|
| 场景标题 | 以 `\d+-\d+` 开头（如 `1-1`、`12-3`） |
| 人物行 | 以 `人物：` 开头 |
| 动作行 | 以 `△` 开头 |
| 台词行 | 包含 `：` 且不是场景标题 |
| 空行 | 场景间分隔 |

**生成流程**（支持暂停/继续）：
1. 前端发起 `POST /scripts/generate`，后端开始 SSE
2. 每集完成后推送 `event:done` + 完整内容，前端更新对应集的 tab 状态为绿色 ●
3. 进度达到 `episodes/episodes`（100%）时，「继续生成」按钮置灰
4. 支持 `POST /scripts/generate/pause` 中断、`POST /scripts/generate/resume` 继续（服务端需维护生成任务状态）

### 6.7 第七步：导出

统计数据实时从数据库计算：
- `total_scenes`：所有 scripts 中场景标题行数之和
- `total_words`：`scripts.word_count` 之和
- `total_episodes`：`projects.episodes`
- `total_duration`：`projects.duration_min`

---

## 7. 用户认证与权限

### JWT 结构

```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "iat": 1724000000,
  "exp": 1724086400
}
```

- Access token 有效期：24小时
- Refresh token 有效期：30天
- 所有 `/api/v1/*` 路由（除 `/auth/*`）需要有效 JWT

### 数据隔离

所有项目查询自动附加 `WHERE user_id = $current_user_id`，严格防止越权访问。

---

## 8. 文件导出服务

### PDF 导出

使用 `puppeteer` 或 `wkhtmltopdf`，将剧本 HTML 模板渲染为 PDF：
- 字体：Noto Sans CJK（中文）/ Inter（英文）
- 页面：A4，上下边距 20mm
- 封面：项目名 + 题材 + 集数 + 生成日期
- 正文按集分章节，场景标题加粗，台词居中缩进

### Word 导出

使用 `docx` npm 包生成 `.docx`，应用与 PDF 相同的样式映射。

### 飞书文档导出

调用飞书开放平台 API：
1. 用户先在设置中完成飞书 OAuth 授权
2. 调用 `POST /open-apis/docx/v1/documents` 创建文档
3. 按块结构逐集写入内容
4. 返回文档链接

### 文件命名规则

```python
def get_export_filename(project, ext, episode_num=None) -> str:
    date_str = datetime.now().strftime("%Y%m%d")
    ts_str = str(int(time.time()))[-6:]
    ep_part = f"_第{episode_num}集" if episode_num else "_全剧"
    return f"{project.name}{ep_part}_{date_str}_{ts_str}.{ext}"
# 示例：霸总爱上小秘书_全剧_20260819_153022.pdf
```

---

## 9. 前端对接说明

前端当前使用 **mock 数据**，对接后端时需替换以下位置：

### 9.1 需要替换 mock 数据的文件

| 文件 | 当前 mock | 替换为 |
|------|-----------|--------|
| `src/data/mockData.ts` | 静态 mock 数据 | 保留类型定义，删除 mock 实例 |
| `src/components/steps/Step2Characters.tsx` | `useState(mockCharacters)` 等 | 从 API 获取，SSE 接收生成内容 |
| `src/components/steps/Step3SegmentOutline.tsx` | `useState(mockSegments)` | 从 API 获取 |
| `src/components/steps/Step4EpisodeGroupOutline.tsx` | `buildGroups()` 静态数据 | 从 API 获取 |
| `src/components/steps/Step5EpisodeSynopsis.tsx` | `useState(mockEpisodeSynopses)` | 从 API 获取 |
| `src/components/steps/Step6Script.tsx` | `scenesToText(mockScriptScenes)` | 从 API 获取 |
| `src/components/steps/HomeView.tsx` | `mockProjects` | 从 API 获取 |
| `src/components/steps/ProjectsView.tsx` | `mockProjects` | 从 API 获取 |

### 9.2 API 客户端封装建议

建议在 `src/api/` 下创建：

```
src/api/
  client.ts         -- axios 实例，自动附加 JWT，处理 401
  projects.ts       -- 项目 CRUD
  step2.ts          -- 第二步接口
  step3.ts          -- 第三步接口
  step4.ts          -- 第四步接口
  step5.ts          -- 第五步接口
  step6.ts          -- 第六步接口
  export.ts         -- 导出接口
  auth.ts           -- 认证接口
  sse.ts            -- SSE 连接封装（EventSource + 重连逻辑）
```

### 9.3 SSE 接收示例（前端）

```typescript
// src/api/sse.ts
export function connectSSE(url: string, handlers: {
  onChunk: (data: any) => void;
  onDone: (data: any) => void;
  onProgress: (data: any) => void;
  onFinish: () => void;
  onError: (err: any) => void;
}) {
  const eventSource = new EventSource(url, {
    // 如需携带 token，需通过 query param 传递（EventSource 不支持自定义 Header）
    // 或改用 fetch + ReadableStream
  });
  eventSource.addEventListener('chunk', e => handlers.onChunk(JSON.parse(e.data)));
  eventSource.addEventListener('done', e => handlers.onDone(JSON.parse(e.data)));
  eventSource.addEventListener('progress', e => handlers.onProgress(JSON.parse(e.data)));
  eventSource.addEventListener('finish', () => { handlers.onFinish(); eventSource.close(); });
  eventSource.addEventListener('error', e => handlers.onError(e));
  return () => eventSource.close(); // 返回清理函数
}
```

> **注意**：浏览器的 `EventSource` 不支持自定义请求头，无法直接传 JWT。推荐方案：
> - 方案A：SSE 端点使用短期 token（从 `/auth/sse-token` 获取一次性 token，作为 query param）
> - 方案B：改用 `fetch` + `Response.body.getReader()` 读取流，可设置 `Authorization` header

### 9.4 AppContext 需新增的状态

```typescript
// 新增到 AppContext
interface AppContextType {
  // ...现有字段...
  userId: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  currentProjectId: string | null;  // 替换现在仅在内存中的 currentProject
}
```

---

## 10. 推荐技术栈

### 后端

| 层级 | 推荐方案 | 备选 |
|------|---------|------|
| 运行时 | Node.js 22 + TypeScript | Python (FastAPI) |
| Web 框架 | Hono 或 Fastify | Express |
| 数据库 | PostgreSQL 16 | - |
| ORM | Drizzle ORM | Prisma |
| AI 客户端 | `@anthropic-ai/sdk` | - |
| 认证 | `jose` (JWT) | - |
| 文件生成 | `docx` + `puppeteer` | - |
| 任务队列 | BullMQ (Redis) | - （可选，用于长时间生成任务） |
| 对象存储 | Cloudflare R2 / S3 | 本地文件系统 |

### 数据库托管

- 开发：本地 Docker PostgreSQL
- 生产：Supabase / Neon / Railway

### 部署

| 组件 | 推荐 |
|------|------|
| 前端 | Cloudflare Pages / Vercel |
| 后端 API | Fly.io / Railway / Render |
| 数据库 | Supabase / Neon |

---

## 11. 环境变量清单

```bash
# 数据库
DATABASE_URL=postgresql://user:pass@host:5432/scriptforge

# JWT
JWT_SECRET=<随机32字符>
JWT_EXPIRES_IN=24h

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5

# 飞书（可选）
FEISHU_APP_ID=...
FEISHU_APP_SECRET=...

# 对象存储（可选，用于导出文件）
S3_BUCKET=scriptforge-exports
S3_REGION=auto
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_ENDPOINT=https://...

# 服务配置
PORT=3000
FRONTEND_URL=https://scriptforge.app
NODE_ENV=production
```

---

## 附录：前端关键枚举值

### market 取值

| 前端值 | 中文显示 | 说明 |
|--------|---------|------|
| `global` | 欧美 | 北美 / 欧洲市场 |
| `latam` | 拉美 | 拉丁美洲市场 |
| `china` | 中国 | 中国短剧市场 |

### script_language 取值

| 值 | 中文 |
|----|------|
| `zh` | 中文 |
| `en` | 英文 |

### dialogue_language 取值

| 值 | 中文 |
|----|------|
| `zh` | 中文 |
| `en-zh` | 英（主）中（辅） |
| `en` | 英文 |

### project status 取值

| 值 | 说明 |
|----|------|
| `draft` | 创作中 |
| `completed` | 已完成（到达第7步） |

### script/segment/episode status 取值

| 值 | 说明 |
|----|------|
| `pending` | 待生成 |
| `generating` | 生成中 |
| `done` | 已生成 |
