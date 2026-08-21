import { get, post, patch } from './client';
import type { Script, ScriptSummary } from './types';

export function getScripts(projectId: string): Promise<ScriptSummary[]> {
  return get<ScriptSummary[]>(`/projects/${projectId}/scripts`);
}

export function getScript(projectId: string, epNum: number): Promise<Script> {
  return get<Script>(`/projects/${projectId}/scripts/${epNum}`);
}

export function pauseScripts(projectId: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>(`/projects/${projectId}/scripts/generate/pause`);
}

export function resumeScripts(projectId: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>(`/projects/${projectId}/scripts/generate/resume`);
}

export function generateScripts(projectId: string): Promise<Script[]> {
  return post<Script[]>(`/projects/${projectId}/scripts/generate`);
}

export function generateScript(projectId: string, epNum: number): Promise<Script> {
  return post<Script>(`/projects/${projectId}/scripts/${epNum}/generate`);
}

export function updateScript(projectId: string, epNum: number, content: string): Promise<Script> {
  return patch<Script>(`/projects/${projectId}/scripts/${epNum}`, { content });
}

export function feedbackScript(projectId: string, epNum: number, feedback: string): Promise<Script> {
  return post<Script>(`/projects/${projectId}/scripts/${epNum}/feedback`, { feedback });
}
