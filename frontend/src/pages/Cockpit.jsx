import { useAppStore } from '../store/useAppStore';
import HomeView from '../components/views/HomeView';
import DiscoverView from '../components/views/DiscoverView';
import CheckJobView from '../components/views/CheckJobView';
import ApplicationsView from '../components/views/ApplicationsView';
import ResumesView from '../components/views/ResumesView';
import SettingsView from '../components/views/SettingsView';

export default function Cockpit() {
  const currentView = useAppStore((state) => state.currentView);

  switch (currentView) {
    case 'discover':
      return <DiscoverView />;
    case 'check':
      return <CheckJobView />;
    case 'applications':
      return <ApplicationsView />;
    case 'resumes':
      return <ResumesView />;
    case 'settings':
      return <SettingsView />;
    case 'home':
    default:
      return <HomeView />;
  }
}
