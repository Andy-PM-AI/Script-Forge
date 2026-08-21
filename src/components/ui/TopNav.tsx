import { useApp, View } from '../../context/AppContext';

const STEPS: { id: View; label: string; num: number }[] = [
  { id: 'step1', label: '项目设定', num: 1 },
  { id: 'step2', label: '人物故事', num: 2 },
  { id: 'step3', label: '分段粗纲', num: 3 },
  { id: 'step4', label: '分集粗纲', num: 4 },
  { id: 'step5', label: '分集脚本', num: 5 },
  { id: 'step6', label: '分镜脚本', num: 6 },
  { id: 'step7', label: '导出', num: 7 },
];

const SPARK_STEPS: { id: View; label: string }[] = [
  { id: 'spark1', label: '选择市场' },
  { id: 'spark2', label: '选择题材' },
  { id: 'spark3', label: '参数设置' },
  { id: 'spark4', label: '生成灵感' },
];

function stepIndex(view: View) {
  return STEPS.findIndex(s => s.id === view);
}

function sparkStepIndex(view: View) {
  return SPARK_STEPS.findIndex(s => s.id === view);
}

export default function TopNav() {
  const { view, navigate, startNewProject, project } = useApp();
  const currentStepIdx = stepIndex(view);
  const currentSparkIdx = sparkStepIndex(view);
  const isWorkflow = currentStepIdx >= 0;
  const isSpark = currentSparkIdx >= 0;
  const eps = project?.episodes ?? 80;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center px-6 h-16"
      style={{ backgroundColor: 'rgba(26,26,46,0.95)', borderBottom: '1px solid var(--color-border)', backdropFilter: 'blur(12px)' }}
    >
      {/* Logo */}
      <button
        className="flex items-center gap-2 mr-8 flex-shrink-0"
        onClick={() => navigate('home')}
      >
        <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="font-bold text-sm">
          <span style={{ color: 'var(--color-text)' }}>Script</span>
          <span className="gradient-text">Forge</span>
        </span>
      </button>

      {/* Workflow step progress */}
      {isWorkflow && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-0">
            {STEPS.map((step, i) => {
              const num = i + 1;
              // 用户可到达的最大步骤 = 已推进到的 current_step 与当前所在步骤的较大者。
              const reachedStep = Math.max(project?.current_step ?? 1, currentStepIdx + 1);
              const isSkipped = step.id === 'step3' && eps <= 40;
              const isDone = i < currentStepIdx;
              const isActive = i === currentStepIdx;
              const isLocked = !isSkipped && num > reachedStep;

              return (
                <div key={step.id} className="flex items-center">
                  {/* Connector */}
                  {i > 0 && (
                    <div
                      className="w-8 h-px transition-all"
                      style={{
                        background: isDone ? 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' : 'var(--color-border)',
                        opacity: isSkipped ? 0.3 : 1,
                        borderStyle: isSkipped ? 'dashed' : 'solid',
                      }}
                    />
                  )}
                  {/* Node */}
                  <button
                    onClick={() => { if (isSkipped || isLocked) return; navigate(step.id); }}
                    className="flex flex-col items-center gap-1"
                    style={{ opacity: isSkipped || isLocked ? 0.35 : 1, cursor: isSkipped || isLocked ? 'not-allowed' : 'pointer' }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={
                        isDone
                          ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                          : isActive
                          ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white', boxShadow: '0 0 0 3px rgba(108,92,231,0.25)' }
                          : { backgroundColor: 'var(--color-bg-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-muted)' }
                      }
                    >
                      {isDone ? (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : step.num}
                    </div>
                    <span
                      className="text-xs whitespace-nowrap hidden lg:block"
                      style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-muted)', fontSize: '10px' }}
                    >
                      {step.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spark step progress */}
      {isSpark && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-0">
            {SPARK_STEPS.map((step, i) => {
              const isDone = i < currentSparkIdx;
              const isActive = i === currentSparkIdx;
              const isLocked = i > currentSparkIdx;
              return (
                <div key={step.id} className="flex items-center">
                  {i > 0 && (
                    <div
                      className="w-8 h-px transition-all"
                      style={{
                        background: isDone ? 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' : 'var(--color-border)',
                      }}
                    />
                  )}
                  <button
                    onClick={() => { if (isLocked) return; navigate(step.id); }}
                    className="flex flex-col items-center gap-1"
                    style={{ opacity: isLocked ? 0.35 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={
                        isDone
                          ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                          : isActive
                          ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white', boxShadow: '0 0 0 3px rgba(108,92,231,0.25)' }
                          : { backgroundColor: 'var(--color-bg-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-muted)' }
                      }
                    >
                      {isDone ? (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : i + 1}
                    </div>
                    <span
                      className="text-xs whitespace-nowrap hidden lg:block"
                      style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-muted)', fontSize: '10px' }}
                    >
                      {step.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isWorkflow && !isSpark && <div className="flex-1" />}

      {/* Right */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-8">
        {view === 'home' && (
          <button
            onClick={startNewProject}
            className="gradient-primary text-white text-xs px-4 py-2 rounded-lg font-semibold"
          >
            + 新建项目
          </button>
        )}
        <button
          onClick={() => navigate('projects')}
          className="text-xs px-3 py-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-muted)' }}
        >
          我的项目
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' }}
        >
          U
        </div>
      </div>
    </header>
  );
}
