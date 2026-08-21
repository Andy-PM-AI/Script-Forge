import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.ts';

const url = process.env.DATABASE_URL ?? 'postgresql://scriptforge:scriptforge@localhost:5432/scriptforge';

export const sql = postgres(url, { max: 10 });
export const db = drizzle(sql, { schema });
export type Db = typeof db;
export { schema };
