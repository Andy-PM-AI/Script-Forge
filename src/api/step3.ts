import { get, post, patch } from './client';
import type { Segment } from './types';

export interface SegmentPatch {
  title?: string | null;
  hook?: string | null;
  summary?: string | null;
  ending_hook?: string | null;
}

export function getSegments(projectId: string): Promise<Segment[]> {
  return get<Segment[]>(`/projects/${projectId}/segments`);
}

export function generateSegments(projectId: string): Promise<Segment[] | { completed: number; total: number }> {
  return post<Segment[]>(`/projects/${projectId}/segments/generate`);
}

export function generateSegment(projectId: string, segId: string): Promise<Segment> {
  return post<Segment>(`/projects/${projectId}/segments/${segId}/generate`);
}

export function updateSegment(projectId: string, segId: string, input: SegmentPatch): Promise<Segment> {
  return patch<Segment>(`/projects/${projectId}/segments/${segId}`, input);
}

export function feedbackSegment(projectId: string, segId: string, feedback: string): Promise<Segment> {
  return post<Segment>(`/projects/${projectId}/segments/${segId}/feedback`, { feedback });
}
