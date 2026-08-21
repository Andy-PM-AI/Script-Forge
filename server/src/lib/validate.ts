import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';

/** 读取并校验 JSON 请求体，失败抛 400。返回 schema 的推断输出类型。 */
export async function parseJson<S extends z.ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  let json: unknown = {};
  try {
    json = await c.req.json();
  } catch {
    json = {};
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('；');
    throw new HTTPException(400, { message: msg });
  }
  return result.data as z.infer<S>;
}
