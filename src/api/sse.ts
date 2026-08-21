const BASE_URL = '/api/v1';

/**
 * 发起一个带 body 的 POST 流式请求并逐事件解析 SSE。
 * 后端（Hono streamSSE）按 `event: <name>\ndata: <json>\n\n` 输出。
 */
export async function streamSSE<T = unknown>(
  path: string,
  body: unknown,
  onEvent: (event: string, data: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `请求失败 (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody && typeof errBody.message === 'string') message = errBody.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx = buffer.indexOf('\n\n');
    while (idx >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      parseBlock(block, onEvent);
      idx = buffer.indexOf('\n\n');
    }
  }

  if (buffer.trim()) parseBlock(buffer, onEvent);
}

function parseBlock<T>(block: string, onEvent: (event: string, data: T) => void) {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) return;

  const raw = dataLines.join('\n');
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    /* keep raw string */
  }
  onEvent(event, data as T);
}
