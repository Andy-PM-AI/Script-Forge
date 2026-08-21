import { get, post, patch, del } from './client';
import type { Project, ProjectListResponse, ProjectDetail, Market } from './types';

export interface CreateProjectInput {
  name: string;
  market: Market;
  genres: string[];
  episodes: number;
  duration_min: number;
  script_language: 'zh' | 'en';
  dialogue_language: 'zh' | 'en-zh' | 'en';
  synopsis: string | null;
  characters: {
    name: string;
    gender: 'male' | 'female' | 'other';
    is_protagonist: boolean;
    description: string | null;
  }[];
}

export interface UpdateProjectInput {
  name?: string;
  market?: Market;
  genres?: string[];
  episodes?: number;
  duration_min?: number;
  script_language?: 'zh' | 'en';
  dialogue_language?: 'zh' | 'en-zh' | 'en';
  synopsis?: string | null;
  characters?: {
    name: string;
    gender: 'male' | 'female' | 'other';
    is_protagonist: boolean;
    description: string | null;
  }[];
}

export interface ListProjectsParams {
  search?: string;
  market?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

export function listProjects(params?: ListProjectsParams): Promise<ProjectListResponse> {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.market) q.set('market', params.market);
  if (params?.sort) q.set('sort', params.sort);
  if (params?.order) q.set('order', params.order);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return get<ProjectListResponse>(`/projects${qs ? `?${qs}` : ''}`);
}

export function getProject(id: string): Promise<ProjectDetail> {
  return get<ProjectDetail>(`/projects/${id}`);
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return post<Project>('/projects', input);
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  return patch<Project>(`/projects/${id}`, input);
}

export function deleteProject(id: string): Promise<{ ok: boolean }> {
  return del<{ ok: boolean }>(`/projects/${id}`);
}
