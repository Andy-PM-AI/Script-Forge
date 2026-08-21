# ScriptForge · 短剧剧本 AI 创作工具

基于 React 19 + Vite 8 + Tailwind CSS v4 的前端（Figma 已设计），配合 Node 22 + Hono + Drizzle ORM + PostgreSQL 16 的后端，实现 7 步短剧剧本创作工作流：

**项目设定 → 人物/背景/故事线 → 分段粗纲 → 分集粗纲 → 分集脚本 → 分镜脚本 → 导出（PDF / Word）**

集数 ≤ 40 时，分段粗纲（Step3）与分集粗纲（Step4）自动跳过。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19、Vite 8、Tailwind CSS v4、TypeScript |
| 后端 | Node 22、TypeScript、Hono（`@hono/node-server`） |
| 数据库 | PostgreSQL 16（Docker） + Drizzle ORM（postgres.js） |
| AI | DeepSeek API（OpenAI 兼容，默认 `deepseek-v4-flash`），SSE 流式 |
| 导出 | `docx`（Word）+ `puppeteer`（HTML → PDF） |

## 目录结构

```
Script Forge/
  server/          # 后端
    src/           # 路由 / 数据层 / AI / 导出
    docker-compose.yml
    .env.example
  src/             # 前端
    api/           # fetch 封装 + SSE + DTO
    components/    # 各步骤页面 + UI 组件
    context/       # 全局状态（单用户免登录）
```

## 前置条件

1. **Docker Desktop**（用于 PostgreSQL，或自备 Postgres 16）
2. **Node.js 22+** 与 npm
3. **DeepSeek API Key**（可选：无 key 时可切 `AI_PROVIDER=mock` 离线兜底跑通全流程）

## 启动步骤

### 1. 启动数据库

```bash
cd server
docker compose up -d
```

容器 `scriptforge-db` 启动后会自动建表并 seed 一个本地单用户。

### 2. 启动后端（:3001）

```bash
cd server
npm install
cp .env.example .env      # 填入 DEEPSEEK_API_KEY（如需真实 AI）
npm run dev               # tsx watch src/index.ts
```

- 健康检查：`curl http://localhost:3001/health` → `{"ok":true}`
- 数据迁移（如 schema 变更）：`npm run db:push`

### 3. 启动前端（:8443）

```bash
# 在项目根目录
npm install
npm run dev
```

浏览器打开 <http://localhost:8443>。Vite 已将 `/api` 代理到 `http://localhost:3001`，无需跨域配置。

## 环境变量（server/.env）

| 变量 | 默认 | 说明 |
|------|------|------|
| `DATABASE_URL` | `postgresql://scriptforge:scriptforge@localhost:5432/scriptforge` | 数据库连接串 |
| `PORT` | `3001` | 后端端口 |
| `DEEPSEEK_API_KEY` | — | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | API 端点 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | 模型（可切 `deepseek-v4-pro`） |
| `AI_PROVIDER` | `deepseek` | `deepseek`（真实 AI）或 `mock`（离线兜底，无需 key） |

> 离线兜底：未配 key 或想无网跑通 7 步时，将 `AI_PROVIDER` 改为 `mock`，生成端点会返回内置示例内容。

## 认证

本地单用户免登录：后端启动时自动 seed `local@scriptforge.local`，接口不校验 JWT，数据按该用户隔离。

## 导出

- **Word**：`docx` 生成，A4，场景标题加粗、台词居中缩进。
- **PDF**：`puppeteer` 无头 Chrome 渲染 HTML → `page.pdf()`，中文依赖系统字体（macOS PingFang 可用）。
- 文件名：`{项目名}{_全剧|_第N集}_{YYYYMMDD}_{秒末6位}.{ext}`

## 常见问题

- **Chromium 下载失败**：`PUPPETEER_SKIP_DOWNLOAD=1 npm install`，再指定本机 Chrome 的 `executablePath`。
- **PDF 中文乱码**：确认系统已装中文字体（macOS 自带 PingFang，一般无需额外处理）。
- **端口占用**：改 `server/.env` 的 `PORT`，并同步 `vite.config.ts` 的 proxy 目标。
