export type Market = 'china' | 'global' | 'latam';
export type ScriptLanguage = 'zh' | 'en';
export type DialogueLanguage = 'zh' | 'en-zh' | 'en';

export interface Project {
  id: string;
  name: string;
  market: Market;
  genres: string[];
  episodes: number;
  duration_min: number;
  script_language: ScriptLanguage;
  dialogue_language: DialogueLanguage;
  synopsis: string | null;
  current_step: number;
  status: string;
  color_seed: number;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectDetail extends Project {
  characters: Character[];
  stats: {
    total_episodes: number;
    total_scenes: number;
    total_words: number;
    total_duration: number;
  };
}

export interface Character {
  id: string;
  source: 'user_input' | 'ai_generated';
  name: string;
  gender: 'male' | 'female' | 'other' | null;
  age: string | null;
  role: string | null;
  is_protagonist: boolean;
  traits: string[];
  description: string | null;
  backstory: string | null;
  color_seed: number;
}

export interface Step2Payload {
  characters: Character[];
  background: string;
  storyline: string;
}

export interface Segment {
  id: string;
  sort_order: number;
  title: string;
  episode_start: number;
  episode_end: number;
  range: string;
  hook: string | null;
  summary: string | null;
  ending_hook: string | null;
  status: string;
}

export interface EpisodeGroup {
  id: string;
  segment_id: string | null;
  sort_order: number;
  label: string | null;
  episode_start: number;
  episode_end: number;
  range: string;
  hook: string | null;
  summary: string | null;
  ending_hook: string | null;
  status: string;
}

export interface SegmentWithGroups extends Segment {
  groups: EpisodeGroup[];
}

export interface Episode {
  id: string;
  episode_number: number;
  title: string | null;
  hook: string | null;
  synopsis: string | null;
  key_scenes: string[];
  status: string;
}

export interface Script {
  episode_number: number;
  status: string;
  scene_count: number;
  word_count: number;
  content: string;
}

export interface ScriptSummary {
  episode_number: number;
  status: string;
  scene_count: number;
  word_count: number;
}
