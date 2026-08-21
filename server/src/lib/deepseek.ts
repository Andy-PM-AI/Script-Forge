const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash';

function apiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY ?? '';
  if (!key) throw new Error('DEEPSEEK_API_KEY 未配置，请在 server/.env 中填入');
  return key;
}

export interface StreamResult {
  text: string;
  finishReason: string;
}

/** 带超时的 fetch：超时后中止请求，避免上游挂起导致请求永久阻塞。 */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`DeepSeek 响应超时（${Math.round(ms / 1000)}s），请稍后重试`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** 非流式调用，返回完整文本。 */
export async function deepseekChat(prompt: string, maxTokens = 4000): Promise<string> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: maxTokens,
        // deepseek-v4 系列为推理模型，默认会把大量 token 花在 reasoning_content 上，
        // 导致 content 为空（finish_reason=length）。关闭推理以确保直接产出正文。
        reasoning_effort: 'none',
      }),
    },
    90_000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`DeepSeek API 错误 ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? '';
}

/** 流式调用，onDelta 收到增量文本，返回完整文本与结束原因。 */
export async function deepseekStream(
  prompt: string,
  onDelta: (delta: string) => void,
  maxTokens = 4000,
): Promise<StreamResult> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: maxTokens,
        reasoning_effort: 'none',
      }),
    },
    90_000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`DeepSeek API 错误 ${res.status}: ${body.slice(0, 500)}`);
  }

  if (!res.body) throw new Error('DeepSeek API 未返回响应体');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let finishReason = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
        };
        const choice = json.choices?.[0];
        const delta = choice?.delta?.content;
        if (delta) {
          text += delta;
          onDelta(delta);
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      } catch {
        /* 忽略无法解析的 keep-alive 行 */
      }
    }
  }

  return { text, finishReason };
}
