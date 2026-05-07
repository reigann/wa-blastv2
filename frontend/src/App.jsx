import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { useSocket } from './hooks/useSocket';
import { authAPI, systemAPI } from './services/api';
import Login from './pages/Login';
import { clearAuthStorage, getAuthToken, getAuthUser } from './lib/auth';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Blast = lazy(() => import('./pages/Blast'));
const Templates = lazy(() => import('./pages/Templates'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Logs = lazy(() => import('./pages/Logs'));
const Clustering = lazy(() => import('./pages/Clustering'));
const Bandit = lazy(() => import('./pages/Bandit'));

const routeTitleMap = {
  '/': 'Dashboard',
  '/contacts': 'Contacts',
  '/blast': 'Blast',
  '/templates': 'Templates',
  '/sessions': 'Sessions',
  '/logs': 'Logs',
  '/clustering': 'Clustering',
  '/bandit': 'Bandit Analytics',
};

function AppShell({ currentUser, onLogoutApp }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);
  const [notifications, setNotifications] = useState([]);
  const [healthStatus, setHealthStatus] = useState({
    ok: null,
    storage: 'unknown',
    features: {},
  });
  const location = useLocation();
  const { waStatus, qrCode, waPhone, blastProgress, blastStatus } = useSocket();
  const prevWaStatusRef = useRef(null);
  const prevBlastStatusRef = useRef(null);
  const progressBucketRef = useRef(0);

  function pushNotification(payload) {
    setNotifications((prev) => {
      const next = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          read: false,
          createdAt: new Date().toISOString(),
          ...payload,
        },
        ...prev,
      ];
      return next.slice(0, 50);
    });
  }

  useEffect(() => {
    const onResize = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
      if (width < 1200 && width >= 768) {
        setSidebarCollapsed(true);
      }
      if (width >= 1200) {
        setSidebarCollapsed(false);
        setSidebarOpen(false);
      }
      if (width < 768) {
        setSidebarOpen(false);
      }
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const canCollapse = viewportWidth >= 1200;
  const requiresQr = waStatus !== 'connected';

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!waStatus) return;
    if (prevWaStatusRef.current === null) {
      prevWaStatusRef.current = waStatus;
      return;
    }
    if (prevWaStatusRef.current !== waStatus) {
      pushNotification({
        level: waStatus === 'connected' ? 'success' : waStatus === 'qr' ? 'warn' : 'error',
        title: 'WhatsApp Status',
        message: `Status changed to ${waStatus}`,
      });
      prevWaStatusRef.current = waStatus;
    }
  }, [waStatus]);

  useEffect(() => {
    if (!blastStatus) return;
    if (prevBlastStatusRef.current === blastStatus) return;

    if (blastStatus === 'started') {
      progressBucketRef.current = 0;
      pushNotification({
        level: 'info',
        title: 'Blast Started',
        message: 'Campaign has started sending messages.',
      });
    }

    if (blastStatus === 'completed') {
      pushNotification({
        level: 'success',
        title: 'Blast Completed',
        message: `Delivered ${blastProgress?.sent ?? 0}, failed ${blastProgress?.failed ?? 0}.`,
      });
    }

    if (blastStatus === 'cancelled') {
      pushNotification({
        level: 'warn',
        title: 'Blast Cancelled',
        message: 'Current campaign was stopped before completion.',
      });
    }

    prevBlastStatusRef.current = blastStatus;
  }, [blastStatus, blastProgress?.failed, blastProgress?.sent]);

  useEffect(() => {
    if (!blastProgress?.total || blastProgress.total <= 0) return;
    const percentage = Math.round((blastProgress.current / blastProgress.total) * 100);
    const bucket = Math.floor(percentage / 25);
    if (bucket > progressBucketRef.current && bucket < 4) {
      progressBucketRef.current = bucket;
      pushNotification({
        level: 'info',
        title: 'Blast Progress',
        message: `Campaign reached ${bucket * 25}% progress.`,
      });
    }
  }, [blastProgress?.current, blastProgress?.total]);

  useEffect(() => {
    if (!requiresQr) return undefined;

    let timer = null;
    async function refreshStatus() {
      try {
        await authAPI.getStatus();
      } catch (error) {
        // ignore refresh errors; socket will reconnect on auth expiry handling
      }
    }

    refreshStatus();
    timer = setInterval(refreshStatus, 5000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [requiresQr]);

  useEffect(() => {
    let timer = null;

    async function loadHealth() {
      try {
        const response = await systemAPI.health();
        setHealthStatus(response.data || { ok: false, storage: 'unknown', features: {} });
      } catch (error) {
        setHealthStatus((prev) => ({ ...prev, ok: false }));
      }
    }

    loadHealth();
    timer = setInterval(loadHealth, 30000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const title = useMemo(() => routeTitleMap[location.pathname] || 'Overview', [location.pathname]);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  function markAllNotificationsRead() {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  function clearNotifications() {
    setNotifications([]);
  }

  function toggleNotificationRead(id) {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: !item.read } : item)));
  }

  function removeNotification(id) {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        mobileOpen={sidebarOpen}
        closeMobile={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        canCollapse={canCollapse}
        currentUser={currentUser}
        onLogoutApp={onLogoutApp}
      />

      <Topbar
        title={title}
        onMobileToggle={() => setSidebarOpen((prev) => !prev)}
        isMobile={isMobile}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllRead={markAllNotificationsRead}
        onClearNotifications={clearNotifications}
        onToggleNotificationRead={toggleNotificationRead}
        onRemoveNotification={removeNotification}
        currentUser={currentUser}
        onLogoutApp={onLogoutApp}
        waPhone={waPhone}
        healthStatus={healthStatus}
      />

      <main className="app-main">
        <div className="page-wrapper">
          <Suspense
            fallback={
              <div className="d-flex align-items-center justify-content-center py-5">
                <Spinner animation="border" role="status" />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/blast" element={<Blast />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/clustering" element={<Clustering />} />
              <Route path="/bandit" element={<Bandit />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      <Modal show={requiresQr} backdrop="static" keyboard={false} centered>
        <Modal.Header>
          <Modal.Title>Connect WhatsApp</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-secondary mb-3">
            Akun <strong>{currentUser?.name || currentUser?.email}</strong> harus scan QR dulu sebelum bisa pakai aplikasi.
          </p>

          {waStatus === 'qr' ? (
            <div className="text-center">
              {qrCode ? (
                <img src={qrCode} alt="WhatsApp QR" style={{ width: 260, maxWidth: '100%' }} />
              ) : (
                <Spinner animation="border" role="status" />
              )}
              <div className="small text-secondary mt-2">Buka WhatsApp &gt; Linked Devices &gt; Link a Device</div>
            </div>
          ) : waStatus === 'connected' ? (
            <div className="text-center">
              <div className="mb-2">
                <strong>Connected as:</strong>
              </div>
              <div className="h5">{waPhone ? `+${waPhone.replace(/^\+?/, '')}` : 'Unknown'}</div>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span className="text-secondary">Preparing WhatsApp session... ({waStatus})</span>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" className="btn-outline-soft" onClick={onLogoutApp}>
            Logout App
          </Button>
          <Button onClick={() => authAPI.getStatus()} disabled={waStatus === 'connected'}>
            Refresh QR
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function RootRouter() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(getAuthUser());

  useEffect(() => {
    async function bootstrapAuth() {
      const token = getAuthToken();
      if (!token) {
        setIsAuthenticated(false);
        setAuthReady(true);
        return;
      }

      try {
        const response = await authAPI.me();
        const user = response.data?.user || getAuthUser();
        setCurrentUser(user || null);
        setIsAuthenticated(true);
      } catch (error) {
        clearAuthStorage();
        setCurrentUser(null);
        setIsAuthenticated(false);
      } finally {
        setAuthReady(true);
      }
    }

    bootstrapAuth();
  }, []);

  async function handleLogoutApp() {
    try {
      // Attempt to disconnect WhatsApp session first, then invalidate app token
      try {
        await authAPI.logout();
      } catch (err) {
        // ignore if whatsapp logout fails
      }
      await authAPI.logoutApp();
    } catch (error) {
      // ignore remote logout failure
    }
    clearAuthStorage();
    setCurrentUser(null);
    setIsAuthenticated(false);
    navigate('/login', { replace: true });
  }

  function handleLoginSuccess(user) {
    setCurrentUser(user || getAuthUser());
    setIsAuthenticated(true);
    navigate('/', { replace: true });
  }

  if (!authReady) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login onLoginSuccess={handleLoginSuccess} />}
      />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <AppShell currentUser={currentUser} onLogoutApp={handleLogoutApp} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2500,
          style: {
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            fontSize: '13px',
          },
        }}
      />
      <RootRouter />
    </BrowserRouter>
  );
}
