import { get, post, patch } from './client';
import type { SegmentWithGroups, EpisodeGroup } from './types';

export interface GroupPatch {
  label?: string | null;
  hook?: string | null;
  summary?: string | null;
  ending_hook?: string | null;
}

export function getEpisodeGroups(projectId: string): Promise<SegmentWithGroups[]> {
  return get<SegmentWithGroups[]>(`/projects/${projectId}/episode-groups`);
}

export function generateEpisodeGroups(projectId: string): Promise<SegmentWithGroups[]> {
  return post<SegmentWithGroups[]>(`/projects/${projectId}/episode-groups/generate`);
}

export function generateGroup(projectId: string, groupId: string): Promise<EpisodeGroup> {
  return post<EpisodeGroup>(`/projects/${projectId}/episode-groups/${groupId}/generate`);
}

export function updateGroup(projectId: string, groupId: string, input: GroupPatch): Promise<EpisodeGroup> {
  return patch<EpisodeGroup>(`/projects/${projectId}/episode-groups/${groupId}`, input);
}

export function feedbackGroup(projectId: string, groupId: string, feedback: string): Promise<EpisodeGroup> {
  return post<EpisodeGroup>(`/projects/${projectId}/episode-groups/${groupId}/feedback`, { feedback });
}
