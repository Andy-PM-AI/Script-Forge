import { get, post, patch } from './client';
import type { Step2Payload, Character } from './types';

export type Step2Target = 'characters' | 'background' | 'storyline';

export interface CharacterPatch {
  name?: string;
  gender?: 'male' | 'female' | 'other';
  age?: string | null;
  role?: string | null;
  is_protagonist?: boolean;
  traits?: string[];
  description?: string | null;
  backstory?: string | null;
}

export function getStep2(projectId: string): Promise<Step2Payload> {
  return get<Step2Payload>(`/projects/${projectId}/step2`);
}

export function generateStep2(projectId: string, target: 'all' | Step2Target = 'all'): Promise<Step2Payload> {
  return post<Step2Payload>(`/projects/${projectId}/step2/generate`, { target });
}

export function feedbackStep2(
  projectId: string,
  input: { target: Step2Target; target_id?: string | null; feedback: string },
): Promise<Step2Payload> {
  return post<Step2Payload>(`/projects/${projectId}/step2/feedback`, input);
}

export function updateCharacter(projectId: string, charId: string, input: CharacterPatch): Promise<Character> {
  return patch<Character>(`/projects/${projectId}/characters/${charId}`, input);
}

export function updateBackground(projectId: string, content: string): Promise<{ background: string }> {
  return patch<{ background: string }>(`/projects/${projectId}/step2/background`, { content });
}

export function updateStoryline(projectId: string, content: string): Promise<{ storyline: string }> {
  return patch<{ storyline: string }>(`/projects/${projectId}/step2/storyline`, { content });
}

export interface NameRecommendation {
  name: string;
  reason: string;
}

export function fetchNameRecommendations(
  projectId: string,
  characterId: string,
  currentName: string,
): Promise<NameRecommendation[]> {
  return post<{ recommendations: NameRecommendation[] }>(
    `/projects/${projectId}/characters/${characterId}/name-recommendations`,
    { current_name: currentName },
  ).then(r => r.recommendations);
}

export function replaceName(
  projectId: string,
  input: { character_id: string; old_name: string; new_name: string },
): Promise<Step2Payload> {
  return post<Step2Payload>(`/projects/${projectId}/step2/replace-name`, input);
}
