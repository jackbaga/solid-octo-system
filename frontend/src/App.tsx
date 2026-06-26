import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useEffect, useState } from 'react';
import { AppointmentPage } from './pages/AppointmentPage';
import { AuthPage } from './pages/AuthPage';
import { CallManagementPage } from './pages/CallManagementPage';
import { HomePage } from './pages/HomePage';
import { TaskCompletionPage } from './pages/TaskCompletionPage';
import { AuthUser, fetchMe } from './services/authApi';

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
  const [user, setUser] = useState<AuthUser | null>(() => {
    const rawUser = localStorage.getItem('authUser');
    try {
      return rawUser ? JSON.parse(rawUser) as AuthUser : null;
    } catch {
      localStorage.removeItem('authUser');
      return null;
    }
  });
  const [authReady, setAuthReady] = useState(false);

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

  useEffect(() => {
    async function validateSession() {
      const token = localStorage.getItem('authToken');

      if (!token) {
        setAuthReady(true);
        return;
      }

      try {
        const currentUser = await fetchMe();
        localStorage.setItem('authUser', JSON.stringify(currentUser));
        setUser(currentUser);
      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    }

    function handleLogout() {
      setUser(null);
    }

    validateSession();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  function handleAuthenticated(nextUser: AuthUser, token: string) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(nextUser));
    setUser(nextUser);
  }

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

  function renderContent() {
    if (!authReady) {
      return (
        <div className="app-loading">
          <Spin size="large" />
        </div>
      );
    }

    return user ? renderPage() : <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
          colorBgLayout: '#f4f7fb',
          fontSize: 14
        },
        components: {
          Layout: {
            headerBg: '#ffffff'
          }
        }
      }}
    >
      {renderContent()}
    </ConfigProvider>
  );
}
