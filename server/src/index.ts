import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initUser } from './lib/user.ts';
import { projectsRoute } from './routes/projects.ts';
import { step2Route } from './routes/step2.ts';
import { step3Route } from './routes/step3.ts';
import { step4Route } from './routes/step4.ts';
import { step5Route } from './routes/step5.ts';
import { step6Route } from './routes/step6.ts';
import { exportRoute } from './routes/export.ts';
import { sparkRoute } from './routes/spark.ts';

// 加载 server/.env（Node 22 原生支持，不存在则忽略）
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(join(__dirname, '..', '.env'));
} catch {
  /* .env 不存在时忽略 */
}

const app = new Hono();

app.use('/api/*', cors());

app.get('/health', (c) => c.json({ ok: true, service: 'scriptforge-server' }));

const v1 = new Hono();

// 项目集合
v1.route('/projects', projectsRoute);

// AI 灵感火花（Spark）
v1.route('/spark', sparkRoute);

// 单个项目下的各步骤资源（挂载在 /projects/:id 下，子路由通过 c.req.param('id') 取项目 id）
const projectItem = new Hono();
projectItem.route('/', step2Route);
projectItem.route('/', step3Route);
projectItem.route('/', step4Route);
projectItem.route('/', step5Route);
projectItem.route('/', step6Route);
projectItem.route('/', exportRoute);
v1.route('/projects/:id', projectItem);

app.route('/api/v1', v1);

app.notFound((c) => c.json({ message: 'Not Found' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  console.error(err);
  return c.json({ message: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
});

const port = Number(process.env.PORT ?? 3001);

await initUser();
console.log(`✓ 本地用户已就绪`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`✓ ScriptForge server running at http://localhost:${info.port}`);
  console.log(`✓ AI 提供方：${process.env.AI_PROVIDER ?? 'deepseek'}`);
});
