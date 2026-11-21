import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Contact, KanbanSquare, CheckSquare, BarChart3, UserCog, LogOut, BriefcaseBusiness, Moon, Sun, Settings as SettingsIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import api from '../api.js';
import { ROLE_LABELS } from '../api.js';
import WorkspaceToolbar from './WorkspaceToolbar.jsx';

export default function Layout() {
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('crm_theme') || 'light');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('crm_sidebar_collapsed') === 'true');
  const [companyName, setCompanyName] = useState('Northstar CRM');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('crm_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('crm_sidebar_collapsed', String(collapsed)); }, [collapsed]);
  const loadWorkspace = () => api.get('/settings').then(({ data }) => { setCompanyName(data.settings.companyName || 'Northstar CRM'); localStorage.setItem('crm_currency', data.settings.currency || 'USD'); localStorage.setItem('crm_timezone', data.settings.timezone || ''); window.dispatchEvent(new Event('crm-preferences-loaded')); }).catch(() => {});
  useEffect(() => { loadWorkspace(); }, []);
  useEffect(() => { window.addEventListener('crm-settings-updated', loadWorkspace); return () => window.removeEventListener('crm-settings-updated', loadWorkspace); }, []);

  const groups = [
    { label: 'Workspace', links: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/tasks', label: 'My tasks', icon: CheckSquare },
    ] },
    { label: 'Customers', links: [
      { to: '/contacts', label: 'Customers & contacts', icon: Contact },
      { to: '/leads', label: 'Leads', icon: Users },
    ] },
    { label: 'Sales', links: [
      { to: '/pipeline', label: 'Sales pipeline', icon: KanbanSquare },
    ] },
    ...(isManager ? [{ label: 'Management', links: [
      { to: '/reports', label: 'Reports & analytics', icon: BarChart3 },
      { to: '/users', label: 'Team members', icon: UserCog },
    ] }] : []),
    { label: 'System', links: [
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ] },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="sidebar-brand-row">
          <div className="brand" title={companyName}>
            <span className="brand-mark"><BriefcaseBusiness size={16} /></span>
            <span className="brand-name">{companyName}</span>
          </div>
          <button className="sidebar-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <button className="sidebar-create" type="button" onClick={() => navigate('/leads?create=1')} title="Create a new lead">
          <Plus size={17} /><span>New lead</span>
        </button>
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {groups.map((group) => <section className="nav-group" key={group.label} aria-label={group.label}>
            <div className="nav-section-label">{group.label}</div>
            {group.links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} aria-label={label} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Icon size={18} /><span className="nav-label">{label}</span>
              </NavLink>
            ))}
          </section>)}
        </nav>
        <div className="sidebar-utility">
          <button className="sidebar-utility-button" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={collapsed ? `${theme === 'dark' ? 'Light' : 'Dark'} mode` : undefined}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>
          </button>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-account" title={collapsed ? `${user.name} · ${ROLE_LABELS[user.role]}` : undefined}>
            <span className="account-avatar">{user.name?.trim()?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span className="account-copy"><strong>{user.name}</strong><small>{ROLE_LABELS[user.role]}</small></span>
          </div>
          <button
            className="sidebar-signout"
            title={collapsed ? 'Sign out' : undefined}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={16} /><span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="content">
        <WorkspaceToolbar />
        <div className="content-view"><Outlet /></div>
      </main>
    </div>
  );
}
