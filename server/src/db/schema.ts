import { pgTable, uuid, varchar, text, smallint, integer, boolean, timestamp, index, unique, jsonb, doublePrecision } from 'drizzle-orm/pg-core';

/* ── 用户表 ── */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  oauthProvider: varchar('oauth_provider', { length: 50 }),
  oauthId: varchar('oauth_id', { length: 255 }),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/* ── 项目表 ── */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull().default('新剧本项目'),
    market: varchar('market', { length: 20 }).notNull(), // china | global | latam
    genres: text('genres').array().notNull().default([]),
    episodes: smallint('episodes').notNull().default(80),
    durationMin: smallint('duration_min').notNull().default(80),
    scriptLanguage: varchar('script_language', { length: 5 }).notNull().default('zh'),
    dialogueLanguage: varchar('dialogue_language', { length: 10 }).notNull().default('zh'),
    synopsis: text('synopsis'),
    colorSeed: smallint('color_seed').default(0),
    currentStep: smallint('current_step').notNull().default(1),
    status: varchar('status', { length: 20 }).default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_projects_user_id').on(t.userId)],
);

/* ── 人物表 ── */
export const characters = pgTable(
  'characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 20 }).notNull(), // user_input | ai_generated
    name: text('name').notNull(),
    gender: varchar('gender', { length: 10 }),
    age: varchar('age', { length: 20 }),
    role: text('role'),
    isProtagonist: boolean('is_protagonist').default(false),
    traits: text('traits').array(),
    description: text('description'),
    backstory: text('backstory'),
    sortOrder: smallint('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_characters_project_id').on(t.projectId)],
);

/* ── 第二步生成结果 ── */
export const step2Results = pgTable('step2_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  background: text('background'),
  storyline: text('storyline'),
  aiVersion: smallint('ai_version').default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/* ── 分段粗纲（第三步） ── */
export const segments = pgTable(
  'segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sortOrder: smallint('sort_order').notNull(),
    title: varchar('title', { length: 50 }),
    episodeStart: smallint('episode_start').notNull(),
    episodeEnd: smallint('episode_end').notNull(),
    hook: text('hook'),
    summary: text('summary'),
    endingHook: text('ending_hook'),
    status: varchar('status', { length: 20 }).default('pending'),
    aiVersion: smallint('ai_version').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_segments_project_id').on(t.projectId)],
);

/* ── 分集粗纲（第四步） ── */
export const episodeGroups = pgTable(
  'episode_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    // ≤40 集时跳过第三步分段，分集粗纲直接挂到项目下（segmentId 为空）。
    segmentId: uuid('segment_id').references(() => segments.id, { onDelete: 'cascade' }),
    sortOrder: smallint('sort_order').notNull(),
    label: varchar('label', { length: 50 }),
    episodeStart: smallint('episode_start').notNull(),
    episodeEnd: smallint('episode_end').notNull(),
    hook: text('hook'),
    summary: text('summary'),
    endingHook: text('ending_hook'),
    status: varchar('status', { length: 20 }).default('pending'),
    aiVersion: smallint('ai_version').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_episode_groups_project_id').on(t.projectId),
    index('idx_episode_groups_segment_id').on(t.segmentId),
  ],
);

/* ── 分集脚本大纲（第五步） ── */
export const episodes = pgTable(
  'episodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    episodeNumber: smallint('episode_number').notNull(),
    title: text('title'),
    hook: text('hook'),
    synopsis: text('synopsis'),
    keyScenes: text('key_scenes').array(),
    status: varchar('status', { length: 20 }).default('pending'),
    aiVersion: smallint('ai_version').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_episodes_project_id').on(t.projectId),
    unique('uniq_episodes_project_number').on(t.projectId, t.episodeNumber),
  ],
);

/* ── 分镜脚本（第六步） ── */
export const scripts = pgTable(
  'scripts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    episodeNumber: smallint('episode_number').notNull(),
    content: text('content'),
    status: varchar('status', { length: 20 }).default('pending'),
    aiVersion: smallint('ai_version').default(1),
    wordCount: integer('word_count'),
    sceneCount: smallint('scene_count'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_scripts_project_id').on(t.projectId),
    unique('uniq_scripts_project_number').on(t.projectId, t.episodeNumber),
  ],
);

/* ── AI 操作历史 ── */
export const aiFeedbackHistory = pgTable(
  'ai_feedback_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    step: smallint('step').notNull(),
    targetType: varchar('target_type', { length: 50 }),
    targetId: uuid('target_id'),
    feedback: text('feedback').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_feedback_project').on(t.projectId)],
);

/* ── AI 灵感火花（Spark）：会话 ── */
export const sparkSessions = pgTable(
  'spark_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    market: varchar('market', { length: 20 }).notNull(),
    genres: text('genres').array().notNull().default([]),
    episodes: smallint('episodes').notNull().default(80),
    duration: smallint('duration').notNull().default(80),
    scriptLang: varchar('script_lang', { length: 10 }).notNull().default('en'),
    dialogueLang: varchar('dialogue_lang', { length: 10 }).notNull().default('en'),
    params: jsonb('params').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [index('idx_spark_sessions_user').on(t.userId)],
);

/* ── AI 灵感火花（Spark）：初稿 ── */
export const sparkDrafts = pgTable(
  'spark_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sparkSessions.id, { onDelete: 'cascade' }),
    draftIndex: integer('draft_index').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    highConcept: text('high_concept'),
    highConceptSource: text('high_concept_source'),
    characters: jsonb('characters'),
    emotion: jsonb('emotion'),
    memories: jsonb('memories'),
    risks: jsonb('risks'),
    noveltyScore: doublePrecision('novelty_score'),
    similarityScore: doublePrecision('similarity_score'),
    diffAxes: jsonb('diff_axes'),
    rejectReasons: text('reject_reasons').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_spark_drafts_session').on(t.sessionId),
    unique('uniq_spark_drafts_session_index').on(t.sessionId, t.draftIndex),
  ],
);

/* ── AI 灵感火花（Spark）：去重账本（仅采纳时写入） ── */
export const sparkDedupLedger = pgTable(
  'spark_dedup_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    market: varchar('market', { length: 20 }).notNull(),
    genres: text('genres').array().notNull().default([]),
    archetype: text('archetype').notNull(),
    spine: text('spine').notNull(),
    adoptedAt: timestamp('adopted_at', { withTimezone: true }).defaultNow(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('idx_ledger_user_market').on(t.userId, t.market),
    index('idx_ledger_adopted_at').on(t.adoptedAt),
  ],
);

/* ── AI 灵感火花（Spark）：KB 素材库（只读） ── */
export const kbElements = pgTable(
  'kb_elements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    market: varchar('market', { length: 20 }).notNull().default('global'),
    genreTags: text('genre_tags').array().notNull().default([]),
    emotionTags: text('emotion_tags').array().notNull().default([]),
    type: varchar('type', { length: 30 }).notNull(),
    grade: varchar('grade', { length: 1 }).notNull().default('B'),
    content: text('content').notNull(),
    usageCount: integer('usage_count').notNull().default(0),
    lastUsed: timestamp('last_used', { withTimezone: true }),
    sourceWork: text('source_work'),
    meta: jsonb('meta'),
  },
  (t) => [
    index('idx_kb_type_grade').on(t.type, t.grade),
    index('idx_kb_genre_tags').on(t.genreTags),
  ],
);
