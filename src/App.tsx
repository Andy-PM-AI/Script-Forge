import { AppProvider, useApp } from './context/AppContext';
import HomeView from './components/steps/HomeView';
import Step1Setup from './components/steps/Step1Setup';
import Step2Characters from './components/steps/Step2Characters';
import Step3SegmentOutline from './components/steps/Step3SegmentOutline';
import Step4EpisodeGroupOutline from './components/steps/Step4EpisodeGroupOutline';
import Step5EpisodeSynopsis from './components/steps/Step5EpisodeSynopsis';
import Step6Script from './components/steps/Step6Script';
import Step7Export from './components/steps/Step7Export';
import ProjectsView from './components/steps/ProjectsView';
import SparkStep1Market from './components/spark/SparkStep1Market';
import SparkStep2Genre from './components/spark/SparkStep2Genre';
import SparkStep3Params from './components/spark/SparkStep3Params';
import SparkStep4Generate from './components/spark/SparkStep4Generate';
import SparkAdopt from './components/spark/SparkAdopt';

function Router() {
  const { view } = useApp();
  switch (view) {
    case 'home': return <HomeView />;
    case 'projects': return <ProjectsView />;
    case 'step1': return <Step1Setup />;
    case 'step2': return <Step2Characters />;
    case 'step3': return <Step3SegmentOutline />;
    case 'step4': return <Step4EpisodeGroupOutline />;
    case 'step5': return <Step5EpisodeSynopsis />;
    case 'step6': return <Step6Script />;
    case 'step7': return <Step7Export />;
    case 'spark1': return <SparkStep1Market />;
    case 'spark2': return <SparkStep2Genre />;
    case 'spark3': return <SparkStep3Params />;
    case 'spark4': return <SparkStep4Generate />;
    case 'spark-adopt': return <SparkAdopt />;
    default: return <HomeView />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
