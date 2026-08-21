import { ensureLocalUser } from '../db/seed.ts';

let uid: string | null = null;

export async function initUser(): Promise<void> {
  uid = await ensureLocalUser();
}

export function currentUserId(): string {
  if (!uid) throw new Error('本地用户未初始化');
  return uid;
}
