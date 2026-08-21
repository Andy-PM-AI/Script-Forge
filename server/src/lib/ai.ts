import { deepseekChat, deepseekStream, type StreamResult } from './deepseek.ts';
import { mockGenerate } from './mock.ts';

const PROVIDER = process.env.AI_PROVIDER ?? 'deepseek';

export interface GenerateOptions {
  maxTokens?: number;
  step?: string;
  ctx?: Record<string, string>;
}

export function isRealAi(): boolean {
  return PROVIDER !== 'mock';
}

/** 生成完整文本（非流式）。mock 模式忽略 prompt，返回示例内容。 */
export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  if (PROVIDER === 'mock') return mockGenerate(opts.step ?? 'script', opts.ctx);
  return deepseekChat(prompt, opts.maxTokens ?? 4000);
}

/** 流式生成，返回完整文本。mock 模式一次性回调整段内容。 */
export async function streamText(
  prompt: string,
  onDelta: (delta: string) => void,
  opts: GenerateOptions = {},
): Promise<StreamResult> {
  if (PROVIDER === 'mock') {
    const text = mockGenerate(opts.step ?? 'script', opts.ctx);
    onDelta(text);
    return { text, finishReason: 'stop' };
  }
  return deepseekStream(prompt, onDelta, opts.maxTokens ?? 4000);
}
