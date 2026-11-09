import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { app } from '../js/app.js';
import { store } from '../js/store.js';
import { api } from '../js/api.js';
import { DashboardView } from './DashboardView';
import { StatementsView } from './StatementsView';
import {
  CashierView,
  FrontDeskView,
  HousekeepingView,
  PosView,
  SettingsView,
  TapeChartView
} from './OperationalViews';
import type { AnalyticsOverview } from './types';
import './app.css';

const navigation = [
  { group: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  { group: 'Front Desk', items: [
    { id: 'frontdesk', label: 'Front Desk Workbench', icon: 'desk' },
    { id: 'tapechart', label: 'Room Rack (Tape Chart)', icon: 'calendar' }
  ] },
  { group: 'Operations', items: [
    { id: 'housekeeping', label: 'Housekeeping Board', icon: 'housekeeping' },
    { id: 'pos', label: 'Point of Sale Outlets', icon: 'cart' }
  ] },
  { group: 'Finance & Accounts', items: [
    { id: 'cashier', label: 'Cashiering & Folios', icon: 'cash' },
    { id: 'statements', label: 'Financial Statements', icon: 'chart' }
  ] },
  { group: 'System', items: [{ id: 'settings', label: 'Property & Gateways', icon: 'settings' }] }
] as const;

type HotelView = typeof navigation[number]['items'][number]['id'];

const viewTitles: Record<HotelView, string> = {
  dashboard: 'Executive Dashboard',
  frontdesk: 'Front Desk & Arrivals Workbench',
  tapechart: 'Room Rack (Tape Chart)',
  housekeeping: 'Housekeeping Turnaround',
  pos: 'Point of Sale Outlets',
  cashier: 'Cashiering & Folios',
  statements: 'Financial Statements',
  settings: 'Property & Gateway Settings'
};

function renderView(view: HotelView, posReservationId: string): ReactNode {
  switch (view) {
    case 'dashboard': return '';
    case 'frontdesk': return <FrontDeskView />;
    case 'tapechart': return <TapeChartView />;
    case 'housekeeping': return <HousekeepingView />;
    case 'pos': return <PosView initialReservationId={posReservationId} />;
    case 'cashier': return <CashierView />;
    case 'statements': return '';
    case 'settings': return <SettingsView />;
  }
}

function isHotelView(value: string): value is HotelView {
  return Object.hasOwn(viewTitles, value);
}

function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>,
    desk: <><path d="M4 18h16M6 18a6 6 0 0 1 12 0M12 8v4M10 8h4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    housekeeping: <><path d="M14 3l7 7M12 8l4 4-6 8H4l3-4z" /></>,
    cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l3 12h11l2-8H6" /></>,
    cash: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></>,
    chart: <><path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function App() {
  const [view, setView] = useState<HotelView>('dashboard');
  const [revision, setRevision] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(app.theme === 'dark' ? 'dark' : 'light');
  const [backendOnline, setBackendOnline] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [analyticsNotice, setAnalyticsNotice] = useState('');
  const [analyticsVersion, setAnalyticsVersion] = useState(0);
  const [posReservationId, setPosReservationId] = useState('');
  const operationalView = useMemo(() => renderView(view, posReservationId), [view, posReservationId, revision]);

  useEffect(() => {
    app.setViewUpdater((nextView: string) => {
      if (!isHotelView(nextView)) return;
      setView(nextView);
      setRevision(current => current + 1);
    });
    app.init();
    return () => app.setViewUpdater(null);
  }, []);

  useEffect(() => {
    setBackendOnline(app.isBackendOnline);
  }, [revision]);

  useEffect(() => {
    const refresh = () => {
      setAnalyticsVersion(current => current + 1);
      setRevision(current => current + 1);
    };
    window.addEventListener('analytics:refresh', refresh);
    window.addEventListener('auth:expired', refresh);
    return () => {
      window.removeEventListener('analytics:refresh', refresh);
      window.removeEventListener('auth:expired', refresh);
    };
  }, []);

  useEffect(() => {
    const openPos = (event: Event) => {
      const detail = (event as CustomEvent<{ reservationId: string }>).detail;
      if (!detail?.reservationId) return;
      setPosReservationId(detail.reservationId);
      setSidebarOpen(false);
      app.setSidebarOpen(false);
      app.navigate('pos');
    };
    window.addEventListener('pos:open', openPos);
    return () => window.removeEventListener('pos:open', openPos);
  }, []);

  useEffect(() => {
    if (view !== 'dashboard') return;
    if (!backendOnline) {
      setAnalytics(null);
      setAnalyticsNotice('');
      return;
    }
    if (!api.token) {
      setAnalytics(null);
      setAnalyticsNotice('Sign in with an administrator or accountant account to load live, ledger-backed analytics. Demo metrics are shown until then.');
      return;
    }

    let cancelled = false;
    const today = store.todayISO();
    api.getAnalyticsOverview(store.addDays(today, -13), store.addDays(today, 14))
      .then(data => {
        if (cancelled) return;
        setAnalytics(data as AnalyticsOverview);
        setAnalyticsNotice('');
      })
      .catch(error => {
        if (cancelled) return;
        setAnalytics(null);
        setAnalyticsNotice(`Live analytics could not be loaded (${error.message}). Demo metrics are shown.`);
      });

    return () => { cancelled = true; };
  }, [view, backendOnline, analyticsVersion]);

  function navigate(event: MouseEvent<HTMLButtonElement>, nextView: HotelView) {
    event.stopPropagation();
    setSidebarOpen(false);
    app.setSidebarOpen(false);
    app.navigate(nextView);
  }

  function toggleTheme() {
    app.toggleTheme();
    setTheme(app.theme === 'dark' ? 'dark' : 'light');
    setRevision(current => current + 1);
  }

  return (
    <div
      className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}
      id="app-shell"
      onClick={event => {
        if (event.target === event.currentTarget && sidebarOpen) {
          setSidebarOpen(false);
          app.setSidebarOpen(false);
        }
      }}
    >
      <aside className="app-sidebar" aria-label="Main Navigation">
        <div className="brand-header">
          <div className="brand-logo" aria-hidden="true">S</div>
          <div>
            <div className="brand-title">Savanna Crest</div>
            <div className="brand-subtitle">Hotel · Operations</div>
          </div>
        </div>
        <nav className="nav-container" id="main-navigation">
          {navigation.map(section => (
            <div key={section.group}>
              <div className="nav-group-title">{section.group}</div>
              {section.items.map(item => (
                <button
                  className={`nav-item${view === item.id ? ' active' : ''}`}
                  data-view={item.id}
                  key={item.id}
                  onClick={event => navigate(event, item.id)}
                  type="button"
                >
                  <NavigationIcon name={item.icon} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontWeight: 600, color: '#fff' }}>{api.token ? 'Signed in' : 'Local demo access'}</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Savanna Crest Hotel System</div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            className="btn-icon sidebar-toggle"
            id="sidebar-toggle-btn"
            type="button"
            aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={sidebarOpen}
            aria-controls="main-navigation"
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              app.setSidebarOpen(!sidebarOpen);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 id="topbar-view-title">{viewTitles[view]}</h1>
          <div className="topbar-grow" />
          <div id="system-status-indicator" className={`system-status-pill${backendOnline ? '' : ' offline'}`}>
            <span className="indicator-dot" />
            {backendOnline ? 'Backend API Connected' : 'Standalone Demo Mode'}
          </div>
          {backendOnline && (
            <button className="btn btn-sm" data-action={api.token ? 'logout' : 'login'} type="button">
              {api.token ? 'Sign out' : 'Sign in'}
            </button>
          )}
          <button
            className="btn-icon"
            id="theme-toggle-btn"
            title="Toggle Theme"
            aria-label="Toggle Color Theme"
            type="button"
            onClick={toggleTheme}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><path d="M12 4v16" fill="currentColor" /></svg>
          </button>
          <button className="btn btn-primary" data-action="modal-newbooking" aria-label="New booking" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
            New Booking
          </button>
        </header>
        {view === 'dashboard' && analyticsNotice && (
          <div className="analytics-notice" role="status">{analyticsNotice}</div>
        )}
        <main
          id="main-content-view"
          className="main-viewport"
        >
          {view === 'dashboard'
            ? <DashboardView analytics={analytics} revision={revision} theme={theme} />
            : view === 'statements'
              ? <StatementsView authVersion={analyticsVersion} theme={theme} />
              : operationalView}
        </main>
      </div>
    </div>
  );
}
