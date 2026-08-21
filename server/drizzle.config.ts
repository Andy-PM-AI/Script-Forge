import { defineConfig } from 'drizzle-kit';

// 加载 .env（drizzle-kit 不会自动读取，Node 22 原生加载）
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.('.env');
} catch {
  /* 忽略 */
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://scriptforge:scriptforge@localhost:5432/scriptforge',
  },
});
