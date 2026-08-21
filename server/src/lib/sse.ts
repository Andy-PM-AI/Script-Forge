import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

type Sender = (event: string, data: unknown) => Promise<void>;

/**
 * 启动一段 SSE 响应。handler 内通过 send(event, data) 推送事件；
 * 发生异常（含 ABORTED）时自动推送 error 事件。onClose 在客户端断开时调用。
 */
export function startSSE(c: Context, handler: (send: Sender) => Promise<void>, onClose?: () => void) {
  return streamSSE(c, async (stream) => {
    if (onClose) stream.onAbort(onClose);

    const send: Sender = async (event, data) => {
      await stream.writeSSE({ event, data: JSON.stringify(data) });
    };

    try {
      await handler(send);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const event = message === 'ABORTED' ? 'error' : 'error';
      const data = message === 'ABORTED' ? { code: 'ABORTED', message: '生成已中止' } : { code: 'AI_ERROR', message };
      await send(event, data).catch(() => {});
    }
  });
}
