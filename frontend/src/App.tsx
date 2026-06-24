import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useEffect, useState } from 'react';
import { AppointmentPage } from './pages/AppointmentPage';
import { CallManagementPage } from './pages/CallManagementPage';
import { HomePage } from './pages/HomePage';
import { TaskCompletionPage } from './pages/TaskCompletionPage';

type Route = 'home' | 'appointments' | 'call' | 'tasks';

function getRouteFromHash(): Route {
  if (window.location.pathname === '/appointments') {
    return 'appointments';
  }

  const hash = window.location.hash.replace('#/', '');

  if (hash === 'appointments' || hash === 'call' || hash === 'tasks') {
    return hash;
  }

  return 'home';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRouteFromHash);

  useEffect(() => {
    function handleHashChange() {
      setRoute(getRouteFromHash());
    }

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  function renderPage() {
    if (route === 'appointments') {
      return <AppointmentPage />;
    }

    if (route === 'call') {
      return <CallManagementPage />;
    }

    if (route === 'tasks') {
      return <TaskCompletionPage />;
    }

    return <HomePage />;
  }

  return (
    <ConfigProvider locale={zhCN}>
      {renderPage()}
    </ConfigProvider>
  );
}
