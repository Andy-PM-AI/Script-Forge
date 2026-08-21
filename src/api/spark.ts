import type { SparkParams } from '../context/AppContext';

const BASE_URL = '/api/v1';

export interface SparkCharacter {
  name: string;
  role: string;
  archetype: string;
  description: string;
  color_seed: number;
}

export interface SparkMemory {
  num: string;
  title: string;
  desc: string;
  episode: string;
}

export interface SparkRisk {
  level: 'high' | 'medium' | 'low';
  desc: string;
  mitigation: string;
}

export interface SparkDraft {
  draft_id: string;
  session_id: string;
  draft_index: number;
  status?: string;
  high_concept: string;
  high_concept_source: string;
  characters: SparkCharacter[];
  emotion_primary: string;
  emotion_secondary: string[];
  emotion_aux: string[];
  emotion_rhythm: string;
  memories: SparkMemory[];
  risks: SparkRisk[];
  novelty_score: number | null;
  similarity_score: number | null;
  archetype: string;
  spine: string;
  diff_validation: boolean;
}

export interface KbCapacity {
  novel_count: number;
  archetype_count: number;
  estimated_diff_slots: number;
  capacity_level: 'ok' | 'warn' | 'danger';
}

interface GenerateRequest {
  market: string;
  genres: string[];
  episodes: number;
  duration: number;
  script_language: 'zh' | 'en';
  dialogue_language: 'zh' | 'en-zh' | 'en';
  dedup_cycle: SparkParams['dedupCycle'];
  novelty_ratio: number;
  element_grade: SparkParams['elementGrade'];
  diff_strength: SparkParams['diffStrength'];
  session_id?: string;
  directions?: string[];
  custom_direction?: string;
}

/** 通过 fetch 解析 SSE 流（POST）。onEvent(event, data) 回调每个事件。 */
export async function generateSpark(
  params: GenerateRequest,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  // 内置超时兜底：即便服务端/上游挂起，也保证在 120s 内结束并抛出错误。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    await streamSpark(params, onEvent, controller.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function streamSpark(
  params: GenerateRequest,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/spark/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    let message = `生成失败 (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error('未返回响应体');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx = buffer.indexOf('\n\n');
    while (idx >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      let event = 'message';
      let dataStr = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      let data: Record<string, unknown> = {};
      if (dataStr) {
        try {
          data = JSON.parse(dataStr);
        } catch {
          /* ignore */
        }
      }

      if (event === 'error') {
        streamError = typeof data.message === 'string' ? data.message : '生成失败，请重试';
        continue;
      }
      onEvent(event, data);
      idx = buffer.indexOf('\n\n');
    }
  }

  if (streamError) throw new Error(streamError);
}

export async function rejectSpark(
  draftId: string,
  sessionId: string,
  payload: { reject_count: number; directions: string[]; custom_direction: string },
): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE_URL}/spark/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_id: draftId, session_id: sessionId, ...payload }),
  });
  if (!res.ok) throw new Error(`拒绝失败 (${res.status})`);
  return res.json();
}

export async function adoptSpark(
  draftId: string,
  sessionId: string,
  projectName: string,
): Promise<{ project_id: string; dedup_ledger_written: boolean; axes_locked: { archetype: string; spine: string } }> {
  const res = await fetch(`${BASE_URL}/spark/adopt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_id: draftId, session_id: sessionId, project_name: projectName }),
  });
  if (!res.ok) {
    let message = `采纳失败 (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function getSparkHistory(sessionId: string): Promise<{ items: SparkDraft[] }> {
  const res = await fetch(`${BASE_URL}/spark/history?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return { items: [] };
  return res.json();
}

export async function getKbCapacity(market: string, genres: string[], grade: SparkParams['elementGrade']): Promise<KbCapacity | null> {
  const q = new URLSearchParams({ market, genres: genres.join(','), grade });
  const res = await fetch(`${BASE_URL}/spark/kb/capacity?${q.toString()}`);
  if (!res.ok) return null;
  return res.json();
}
