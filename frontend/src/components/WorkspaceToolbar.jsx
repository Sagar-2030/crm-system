import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  Clock3,
  ContactRound,
  UserRound,
  LoaderCircle,
  Search,
  X,
  Plus,
  ChevronDown,
  Settings2,
  LogOut,
} from 'lucide-react';
import api, { errMsg, fmtDate } from '../api.js';
import { Alert } from './ui.jsx';
import { useAuth } from '../AuthContext.jsx';

const emptyResults = { leads: [], contacts: [], tasks: [], users: [] };

function SearchSection({ title, Icon, items, getTitle, getDetail, onSelect }) {
  if (!items.length) return null;

  return (
    <section className="global-search-section">
      <div className="global-search-section-title"><Icon size={13} /> {title}</div>
      {items.map((item) => (
        <button className="global-search-result" key={item._id} type="button" onClick={() => onSelect(item)}>
          <span className="global-search-result-icon"><Icon size={15} /></span>
          <span className="global-search-result-copy">
            <strong>{getTitle(item)}</strong>
            <small>{getDetail(item)}</small>
          </span>
          <span className="global-search-result-type">{title.slice(0, -1)}</span>
        </button>
      ))}
    </section>
  );
}

function NotificationTask({ task, overdue, onSelect }) {
  return (
    <button className="notification-task" type="button" onClick={() => onSelect(overdue)}>
      <span className={`notification-task-icon${overdue ? ' notification-task-icon-overdue' : ''}`}>
        {overdue ? <AlertCircle size={15} /> : <CalendarClock size={15} />}
      </span>
      <span className="notification-task-copy">
        <strong>{task.title}</strong>
        <small>{task.lead ? task.lead.name : 'General follow-up'}</small>
      </span>
      <span className={`notification-task-date${overdue ? ' is-overdue' : ''}`}>
        {overdue ? 'Overdue' : fmtDate(task.dueDate)}
      </span>
    </button>
  );
}

export default function WorkspaceToolbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager, user, logout } = useAuth();
  const activePath = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
  const currentTitle = {"/":"Dashboard","/leads":"Leads","/contacts":"Customers & contacts","/pipeline":"Sales pipeline","/tasks":"Tasks","/reports":"Reports & analytics","/users":"Team members","/settings":"Settings"}[activePath] || 'Workspace';

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notificationRef = useRef(null);
  const quickCreateRef = useRef(null);
  const profileRef = useRef(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState(emptyResults);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [notifications, setNotifications] = useState({ overdueCount: 0, upcomingCount: 0, overdue: [], upcoming: [] });

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(emptyResults);
      setSearchError('');
      setSearchLoading(false);
      return undefined;
    }

    let active = true;
    setSearchLoading(true);
    setSearchError('');
    const timer = setTimeout(async () => {
      try {
        const [leadsResponse, contactsResponse, tasksResponse, usersResponse] = await Promise.all([
          api.get('/leads', { params: { q: term, limit: 4 } }),
          api.get('/contacts', { params: { q: term, limit: 4 } }),
          api.get('/tasks', { params: { q: term, limit: 4 } }),
          isManager ? api.get('/users', { params: { q: term, active: 'true' } }) : Promise.resolve({ data: { users: [] } }),
        ]);
        if (active) {
          setResults({
            leads: leadsResponse.data.leads,
            contacts: contactsResponse.data.contacts,
            tasks: tasksResponse.data.tasks,
            users: usersResponse.data.users.slice(0, 4),
          });
        }
      } catch (e) {
        if (active) setSearchError(errMsg(e));
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, isManager]);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      setNotificationsLoading(true);
      try {
        const { data } = await api.get('/tasks/notifications');
        if (active) {
          setNotifications(data);
          setNotificationsError('');
        }
      } catch (e) {
        if (active) setNotificationsError(errMsg(e));
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 60 * 1000);
    window.addEventListener('focus', loadNotifications);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', loadNotifications);
    };
  }, []);

  useEffect(() => {
    const closeMenus = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
      if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
      if (!quickCreateRef.current?.contains(event.target)) setQuickCreateOpen(false);
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setQuickCreateOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenus);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', closeMenus);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectSearchResult = (kind, item) => {
    const destination =
      kind === 'leads'
        ? `/leads/${item._id}`
        : kind === 'contacts'
          ? `/contacts/${item._id}`
          : kind === 'tasks' ? `/tasks?q=${encodeURIComponent(item.title)}` : `/users?q=${encodeURIComponent(item.name)}`;
    setSearchOpen(false);
    setQuery('');
    navigate(destination);
  };

  const selectNotification = (overdue) => {
    setNotificationsOpen(false);
    navigate(overdue ? '/tasks?filter=overdue' : '/tasks');
  };

  const totalNotifications = notifications.overdueCount + notifications.upcomingCount;
  const hasSearchResults = results.leads.length + results.contacts.length + results.tasks.length + results.users.length > 0;
  const showSearchDropdown = searchOpen && Boolean(query.trim());

  return (
    <div className="workspace-topbar">
      <div className="workspace-context" aria-label="Current page">
        <div className="workspace-context-breadcrumb"><span>Workspace</span><span>/</span><strong>{currentTitle}</strong></div>
        <div className="workspace-context-title">{currentTitle}</div>
      </div>
      <div className="global-search-wrap" ref={searchRef}>
        <div className={`global-search-box${searchOpen ? ' is-open' : ''}`}>
          <Search size={17} />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search leads, contacts, tasks..."
            aria-label="Search leads, contacts, and tasks"
            aria-expanded={showSearchDropdown}
            aria-controls="global-search-results"
          />
          {query ? (
            <button type="button" className="global-search-clear" onClick={() => { setQuery(''); setSearchOpen(true); }} aria-label="Clear search">
              <X size={15} />
            </button>
          ) : <kbd>Ctrl K</kbd>}
        </div>
        {showSearchDropdown && (
          <div className="global-search-dropdown" id="global-search-results">
            {query.trim().length < 2 ? (
              <div className="global-search-hint">Type at least 2 characters to search your workspace.</div>
            ) : searchLoading ? (
              <div className="global-search-state"><LoaderCircle size={17} className="is-spinning" /> Searching your workspace...</div>
            ) : searchError ? (
              <div className="global-search-error"><Alert>{searchError}</Alert></div>
            ) : hasSearchResults ? (
              <>
                <SearchSection
                  title="Leads"
                  Icon={BriefcaseBusiness}
                  items={results.leads}
                  getTitle={(lead) => lead.name}
                  getDetail={(lead) => [lead.organization, lead.email, lead.stage].filter(Boolean).join(' · ')}
                  onSelect={(lead) => selectSearchResult('leads', lead)}
                />
                <SearchSection
                  title="Contacts"
                  Icon={ContactRound}
                  items={results.contacts}
                  getTitle={(contact) => contact.name}
                  getDetail={(contact) => [contact.organization, contact.email, contact.phone].filter(Boolean).join(' · ')}
                  onSelect={(contact) => selectSearchResult('contacts', contact)}
                />
                <SearchSection
                  title="Tasks"
                  Icon={Clock3}
                  items={results.tasks}
                  getTitle={(task) => task.title}
                  getDetail={(task) => [task.lead?.name, task.status, task.priority].filter(Boolean).join(' · ')}
                  onSelect={(task) => selectSearchResult('tasks', task)}
                />
                <SearchSection title="Employees" Icon={UserRound} items={results.users} getTitle={(employee) => employee.name} getDetail={(employee) => [employee.jobTitle, employee.department, employee.email].filter(Boolean).join(' · ')} onSelect={(employee) => selectSearchResult('users', employee)} />
                <div className="global-search-footer">Results are limited to records you can access.</div>
              </>
            ) : (
              <div className="global-search-empty">
                <Search size={18} />
                <strong>No matching records</strong>
                <span>Try a different name, email, company, or task title.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="notification-wrap" ref={notificationRef}>
        <button
          type="button"
          className={`notification-trigger${notificationsOpen ? ' is-open' : ''}`}
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-label={`Task notifications${totalNotifications ? `, ${totalNotifications} items` : ''}`}
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
        >
          <Bell size={18} />
          {totalNotifications > 0 && <span className="notification-count">{totalNotifications > 99 ? '99+' : totalNotifications}</span>}
        </button>
        {notificationsOpen && (
          <div className="notification-popover" role="dialog" aria-label="Task notifications">
            <div className="notification-heading">
              <div><h2>Task notifications</h2><p>Due now and over the next 7 days.</p></div>
              <span className={`notification-total${notificationsLoading ? ' is-loading' : ''}`}>
                {notificationsLoading ? <LoaderCircle size={14} className="is-spinning" /> : totalNotifications}
              </span>
            </div>
            {notificationsError && <div className="notification-error"><Alert>{notificationsError}</Alert></div>}
            {notifications.overdue.length > 0 && (
              <section className="notification-section">
                <div className="notification-section-title notification-section-overdue">Overdue <span>{notifications.overdueCount}</span></div>
                {notifications.overdue.map((task) => (
                  <NotificationTask key={task._id} task={task} overdue onSelect={selectNotification} />
                ))}
                {notifications.overdueCount > notifications.overdue.length && (
                  <span className="notification-more">{notifications.overdueCount - notifications.overdue.length} more overdue</span>
                )}
              </section>
            )}
            {notifications.upcoming.length > 0 && (
              <section className="notification-section">
                <div className="notification-section-title">Coming up <span>{notifications.upcomingCount}</span></div>
                {notifications.upcoming.map((task) => (
                  <NotificationTask key={task._id} task={task} onSelect={selectNotification} />
                ))}
                {notifications.upcomingCount > notifications.upcoming.length && (
                  <span className="notification-more">{notifications.upcomingCount - notifications.upcoming.length} more upcoming</span>
                )}
              </section>
            )}
            {!notificationsError && !totalNotifications && (
              <div className="notification-clear"><span><Bell size={17} /></span><strong>All caught up</strong><small>No overdue or upcoming follow-ups.</small></div>
            )}
            <div className="notification-footer">
              <button type="button" onClick={() => selectNotification(true)}>View overdue tasks</button>
              <button type="button" onClick={() => selectNotification(false)}>Open task list <span>→</span></button>
            </div>
          </div>
        )}
      </div>

      <div className="toolbar-actions">
        <div className="quick-create-wrap" ref={quickCreateRef}>
          <button type="button" className="quick-create-trigger" aria-expanded={quickCreateOpen} aria-haspopup="menu" onClick={() => { setQuickCreateOpen((open) => !open); setProfileOpen(false); }}>
            <Plus size={15} /> Create <ChevronDown size={13} />
          </button>
          {quickCreateOpen && (
            <div className="toolbar-popover" role="menu" aria-label="Quick create">
              <button type="button" role="menuitem" onClick={() => { setQuickCreateOpen(false); navigate('/leads?create=1'); }}><BriefcaseBusiness size={15} /> New lead</button>
              <button type="button" role="menuitem" onClick={() => { setQuickCreateOpen(false); navigate('/contacts?create=1'); }}><ContactRound size={15} /> New contact</button>
              <button type="button" role="menuitem" onClick={() => { setQuickCreateOpen(false); navigate('/tasks?create=1'); }}><CalendarClock size={15} /> New task</button>
            </div>
          )}
        </div>
        <div className="profile-menu-wrap" ref={profileRef}>
          <button type="button" className="profile-trigger" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => { setProfileOpen((open) => !open); setQuickCreateOpen(false); }}>
            <span className="profile-trigger-avatar">{user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span className="profile-trigger-copy"><strong>{user?.name || 'Account'}</strong><small>{user?.role ? user.role.replace('superadmin', 'Super Admin').replace('manager', 'Manager').replace('agent', 'Sales agent') : 'Workspace user'}</small></span>
            <ChevronDown size={13} />
          </button>
          {profileOpen && (
            <div className="toolbar-popover profile-popover" role="menu" aria-label="Account menu">
              <div className="profile-menu-identity"><strong>{user?.name || 'Account'}</strong><small>{user?.email || 'Signed-in workspace account'}</small></div>
              <div className="toolbar-popover-divider" />
              <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/settings'); }}><Settings2 size={15} /> Workspace settings</button>
              <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); logout(); navigate('/login'); }}><LogOut size={15} /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
