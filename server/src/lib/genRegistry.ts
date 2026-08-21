/** 内存生成任务注册表：单用户本地运行足够，支持暂停/继续/中止。 */

export interface GenTask {
  status: 'running' | 'paused' | 'idle';
  current: number;
  total: number;
  abort: boolean;
}

const tasks = new Map<string, GenTask>();

export function getTask(projectId: string): GenTask | undefined {
  return tasks.get(projectId);
}

export function startTask(projectId: string, total: number): GenTask {
  const task: GenTask = { status: 'running', current: 0, total, abort: false };
  tasks.set(projectId, task);
  return task;
}

export function updateTask(projectId: string, patch: Partial<GenTask>): void {
  const t = tasks.get(projectId);
  if (t) Object.assign(t, patch);
}

export function pauseTask(projectId: string): void {
  updateTask(projectId, { status: 'paused' });
}

export function resumeTask(projectId: string): void {
  updateTask(projectId, { status: 'running' });
}

export function abortTask(projectId: string): void {
  updateTask(projectId, { abort: true, status: 'idle' });
}

export function clearTask(projectId: string): void {
  tasks.delete(projectId);
}

/** 在每项生成前调用：中止时抛错终止，暂停时挂起等待继续。 */
export async function waitIfPaused(projectId: string): Promise<void> {
  const task = tasks.get(projectId);
  if (!task) return;
  while (true) {
    if (task.abort) throw new Error('ABORTED');
    if (task.status !== 'paused') return;
    await new Promise((r) => setTimeout(r, 200));
  }
}
