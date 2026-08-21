import { get, post, patch } from './client';
import type { Episode } from './types';

export interface EpisodePatch {
  title?: string | null;
  hook?: string | null;
  synopsis?: string | null;
  key_scenes?: string[];
}

export function getEpisodes(projectId: string): Promise<Episode[]> {
  return get<Episode[]>(`/projects/${projectId}/episodes`);
}

export function getEpisode(projectId: string, epNum: number): Promise<Episode> {
  return get<Episode>(`/projects/${projectId}/episodes/${epNum}`);
}

export function generateEpisodes(projectId: string): Promise<Episode[]> {
  return post<Episode[]>(`/projects/${projectId}/episodes/generate`);
}

export function generateEpisode(projectId: string, epNum: number): Promise<Episode> {
  return post<Episode>(`/projects/${projectId}/episodes/${epNum}/generate`);
}

export function updateEpisode(projectId: string, epNum: number, input: EpisodePatch): Promise<Episode> {
  return patch<Episode>(`/projects/${projectId}/episodes/${epNum}`, input);
}

export function feedbackEpisode(projectId: string, epNum: number, feedback: string): Promise<Episode> {
  return post<Episode>(`/projects/${projectId}/episodes/${epNum}/feedback`, { feedback });
}
