import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { Project } from '../api/types';
import * as projectsApi from '../api/projects';

export type View =
  | 'home'
  | 'projects'
  | 'step1'
  | 'step2'
  | 'step3'
  | 'step4'
  | 'step5'
  | 'step6'
  | 'step7'
  | 'spark1'
  | 'spark2'
  | 'spark3'
  | 'spark4'
  | 'spark-adopt';

export interface CharacterDraft {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  isProtagonist: boolean;
  description: string;
}

export interface SparkParams {
  market: string;
  genres: string[];
  episodes: number;
  duration: number;
  scriptLanguage: 'zh' | 'en';
  dialogueLanguage: 'zh' | 'en-zh' | 'en';
  dedupCycle: 'session' | '7d' | '30d' | '90d' | '180d' | 'all';
  noveltyRatio: number;
  elementGrade: 'S' | 'SA' | 'SAB';
  diffStrength: 'high' | 'medium' | 'low';
}

const DEFAULT_SPARK_PARAMS: SparkParams = {
  market: '',
  genres: [],
  episodes: 80,
  duration: 80,
  scriptLanguage: 'en',
  dialogueLanguage: 'en',
  dedupCycle: '90d',
  noveltyRatio: 60,
  elementGrade: 'SA',
  diffStrength: 'high',
};

interface AppState {
  view: View;
  currentProjectId: string | null;
  project: Project | null;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  aiHistory: { id: string; text: string; time: string }[];
  aiFeedback: string;
  sparkParams: SparkParams;
  sparkSessionId: string | null;
}

interface AppContextType extends AppState {
  navigate: (view: View) => void;
  /** 进入「新建项目」：清空当前项目后跳转第一步。 */
  startNewProject: () => void;
  /** 进入「AI 灵感火花」：重置参数、生成会话 id 后跳转第一步（选市场）。 */
  startSpark: () => void;
  setSparkParams: (p: Partial<SparkParams>) => void;
  resetSparkParams: () => void;
  /** 由「下一步」触发的跳转：标记下一次挂载的步骤需要自动生成。 */
  nextStep: (view: View) => void;
  /** 消费「下一步」标记，返回是否为「下一步」触发的挂载。 */
  consumeGenerate: () => boolean;
  loadProject: (id: string) => Promise<void>;
  createProject: (input: projectsApi.CreateProjectInput) => Promise<Project>;
  updateProject: (id: string, input: projectsApi.UpdateProjectInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setAiFeedback: (text: string) => void;
  addHistory: (text: string) => void;
  clearHistory: () => void;
}

/** 由项目 current_step 映射到「继续编辑」应打开的视图。 */
export function continueView(p: { status: string; current_step: number; episodes: number }): View {
  if (p.status === 'completed') return 'step7';
  let step = Math.max(2, Math.min(6, p.current_step));
  if (step === 3 && p.episodes <= 40) step = 4;
  return `step${step}` as View;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('home');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiHistory, setAiHistory] = useState<{ id: string; text: string; time: string }[]>([]);
  const [sparkParams, setSparkParamsState] = useState<SparkParams>(DEFAULT_SPARK_PARAMS);
  const [sparkSessionId, setSparkSessionId] = useState<string | null>(null);

  // 同步的最新项目引用，避免 navigate 闭包读到过期 project 导致步骤跳过逻辑误判。
  const projectRef = useRef<Project | null>(null);

  // 「下一步」触发的生成标记：仅当用户在上一步点击「下一步」时才置位，
  // 目标步骤挂载后消费该标记以决定是否自动生成（TopNav/返回上一步不置位）。
  const pendingGenerateRef = useRef(false);

  function navigate(target: View) {
    const eps = projectRef.current?.episodes ?? 80;
    if (target === 'step3' && eps <= 40) {
      setView('step4');
      return;
    }
    setView(target);
    window.scrollTo(0, 0);
  }

  function startNewProject() {
    projectRef.current = null;
    setProject(null);
    setCurrentProjectId(null);
    pendingGenerateRef.current = false;
    setView('step1');
    window.scrollTo(0, 0);
  }

  function startSpark() {
    setSparkParamsState(DEFAULT_SPARK_PARAMS);
    setSparkSessionId(crypto.randomUUID());
    setView('spark1');
    window.scrollTo(0, 0);
  }

  function setSparkParams(p: Partial<SparkParams>) {
    setSparkParamsState((prev) => ({ ...prev, ...p }));
  }

  function resetSparkParams() {
    setSparkParamsState(DEFAULT_SPARK_PARAMS);
  }

  function nextStep(target: View) {
    pendingGenerateRef.current = true;
    navigate(target);
  }

  const consumeGenerate = useCallback(() => {
    const v = pendingGenerateRef.current;
    pendingGenerateRef.current = false;
    return v;
  }, []);

  const loadProject = useCallback(async (id: string) => {
    const detail = await projectsApi.getProject(id);
    projectRef.current = detail;
    setProject(detail);
    setCurrentProjectId(id);
  }, []);

  const createProject = useCallback(async (input: projectsApi.CreateProjectInput) => {
    const created = await projectsApi.createProject(input);
    projectRef.current = created;
    setProject(created);
    setCurrentProjectId(created.id);
    return created;
  }, []);

  const updateProject = useCallback(async (id: string, input: projectsApi.UpdateProjectInput) => {
    const updated = await projectsApi.updateProject(id, input);
    projectRef.current = updated;
    setProject(updated);
    return updated;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await projectsApi.deleteProject(id);
    if (currentProjectId === id) {
      projectRef.current = null;
      setProject(null);
      setCurrentProjectId(null);
    }
  }, [currentProjectId]);

  function addHistory(text: string) {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setAiHistory(prev => [{ id: String(Date.now()), text, time }, ...prev].slice(0, 20));
  }

  function clearHistory() {
    setAiHistory([]);
  }

  return (
    <AppContext.Provider value={{
      view, currentProjectId, project, sidebarOpen, rightPanelOpen, aiFeedback, aiHistory,
      sparkParams, sparkSessionId,
      navigate, startNewProject, startSpark, setSparkParams, resetSparkParams,
      nextStep, consumeGenerate,
      loadProject, createProject, updateProject, deleteProject,
      toggleSidebar: () => setSidebarOpen(v => !v),
      toggleRightPanel: () => setRightPanelOpen(v => !v),
      setAiFeedback,
      addHistory,
      clearHistory,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
