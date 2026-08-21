import { eq } from 'drizzle-orm';
import { db } from './client.ts';
import { users } from './schema.ts';

/** 本地单用户：启动时确保存在，返回其 id。 */
export async function ensureLocalUser(): Promise<string> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, 'local@scriptforge.local')).limit(1);
  if (existing.length > 0) return existing[0].id;

  const [created] = await db
    .insert(users)
    .values({
      email: 'local@scriptforge.local',
      displayName: '本地用户',
      avatarUrl: null,
    })
    .returning({ id: users.id });

  return created.id;
}
