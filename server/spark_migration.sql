CREATE TABLE IF NOT EXISTS spark_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market        VARCHAR(20) NOT NULL,
  genres        TEXT[] NOT NULL DEFAULT '{}',
  episodes      SMALLINT NOT NULL DEFAULT 80,
  duration      SMALLINT NOT NULL DEFAULT 80,
  script_lang   VARCHAR(10) NOT NULL DEFAULT 'en',
  dialogue_lang VARCHAR(10) NOT NULL DEFAULT 'en',
  params        JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_spark_sessions_user ON spark_sessions (user_id);

CREATE TABLE IF NOT EXISTS spark_drafts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES spark_sessions(id) ON DELETE CASCADE,
  draft_index       INTEGER NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  high_concept      TEXT,
  high_concept_source TEXT,
  characters        JSONB,
  emotion           JSONB,
  memories          JSONB,
  risks             JSONB,
  novelty_score     DOUBLE PRECISION,
  similarity_score  DOUBLE PRECISION,
  diff_axes         JSONB,
  reject_reasons    TEXT[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spark_drafts_session ON spark_drafts (session_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spark_drafts_session_index ON spark_drafts (session_id, draft_index);

CREATE TABLE IF NOT EXISTS spark_dedup_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market      VARCHAR(20) NOT NULL,
  genres      TEXT[] NOT NULL DEFAULT '{}',
  archetype   TEXT NOT NULL,
  spine       TEXT NOT NULL,
  adopted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_market ON spark_dedup_ledger (user_id, market);
CREATE INDEX IF NOT EXISTS idx_ledger_adopted_at ON spark_dedup_ledger (adopted_at);

CREATE TABLE IF NOT EXISTS kb_elements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market       VARCHAR(20) NOT NULL DEFAULT 'global',
  genre_tags   TEXT[] NOT NULL DEFAULT '{}',
  emotion_tags TEXT[] NOT NULL DEFAULT '{}',
  type         VARCHAR(30) NOT NULL,
  grade        VARCHAR(1) NOT NULL DEFAULT 'B',
  content      TEXT NOT NULL,
  usage_count  INTEGER NOT NULL DEFAULT 0,
  last_used    TIMESTAMPTZ,
  source_work  TEXT,
  meta         JSONB
);
CREATE INDEX IF NOT EXISTS idx_kb_type_grade ON kb_elements (type, grade);
CREATE INDEX IF NOT EXISTS idx_kb_genre_tags ON kb_elements (genre_tags);
