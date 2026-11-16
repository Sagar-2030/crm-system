import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckSquare2,
  CircleAlert,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  ContactRound,
  UsersRound,
} from 'lucide-react';
import api, { errMsg, fmtDate, fmtDateTime, fmtMoney, ROLE_LABELS, STAGES } from '../api.js';
import { Alert, Empty } from '../components/ui.jsx';
import { useAuth } from '../AuthContext.jsx';

const activityMeta = {
  note: { label: 'added a note', Icon: MessageSquareText },
  call: { label: 'logged a call', Icon: Phone },
  email: { label: 'logged an email', Icon: Mail },
  meeting: { label: 'logged a meeting', Icon: CalendarDays },
  stage_change: { label: 'updated the stage', Icon: ArrowUpRight },
  assignment: { label: 'assigned a lead', Icon: UserRound },
  created: { label: 'created a lead', Icon: Plus },
};

const stageClass = {
  New: 'new',
  Contacted: 'contacted',
  Qualified: 'qualified',
  Proposal: 'proposal',
  Negotiation: 'negotiation',
  Converted: 'converted',
  Lost: 'lost',
};

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user, isManager } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const { data: summary } = await api.get('/dashboard');
      setData(summary);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (!data && error) {
    return (
      <div className="dashboard">
        <Alert>{error}</Alert>
        <button className="btn" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard">
        <div className="dashboard-skeleton skeleton-heading" />
        <div className="dashboard-kpis">
          {Array.from({ length: 10 }, (_, item) => <div key={item} className="dashboard-skeleton skeleton-kpi" />)}
        </div>
        <div className="dashboard-skeleton skeleton-panel" />
      </div>
    );
  }

  const { totals, byStage, recentActivity, upcomingTasks, recentCustomers = [], upcomingMeetings = [] } = data;
  const activeLeads = (byStage.New || 0) + (byStage.Contacted || 0) + (byStage.Qualified || 0) + (byStage.Proposal || 0) + (byStage.Negotiation || 0);
  const pipelineTotal = STAGES.reduce((sum, stage) => sum + (byStage[stage] || 0), 0);
  const overdueTasks = totals.overdueTasks || 0;
  const metrics = [
    {
      label: 'Total leads',
      value: totals.leads,
      detail: 'Across your workspace',
      Icon: UsersRound,
      tone: 'indigo',
    },
    {
      label: 'Customers',
      value: totals.customers || 0,
      detail: 'Customer records in your workspace',
      Icon: ContactRound,
      tone: 'green',
    },
    {
      label: 'Revenue booked',
      value: fmtMoney(totals.revenue, { notation: 'compact', maximumFractionDigits: 1 }),
      detail: 'Won deals in the CRM',
      Icon: Target,
      tone: 'green',
    },
    {
      label: 'Monthly recurring revenue',
      value: fmtMoney(totals.mrr, { notation: 'compact', maximumFractionDigits: 1 }),
      detail: 'Active customer contracts',
      Icon: BarChart3,
      tone: 'blue',
    },
    {
      label: 'Revenue growth',
      value: totals.revenueGrowth == null ? '—' : `${totals.revenueGrowth > 0 ? '+' : ''}${totals.revenueGrowth}%`,
      detail: 'Won revenue vs. previous month',
      Icon: ArrowUpRight,
      tone: (totals.revenueGrowth || 0) >= 0 ? 'green' : 'amber',
    },
    {
      label: 'Customer retention',
      value: totals.retentionRate == null ? '—' : `${totals.retentionRate}%`,
      detail: 'Active and at-risk customers retained',
      Icon: ContactRound,
      tone: 'green',
    },
    {
      label: 'Open pipeline',
      value: fmtMoney(totals.pipelineValue, { notation: 'compact', maximumFractionDigits: 1 }),
      detail: `${fmtMoney(totals.weightedForecast, { notation: 'compact', maximumFractionDigits: 1 })} weighted forecast`,
      Icon: BriefcaseBusiness,
      tone: 'blue',
    },
    {
      label: 'Active opportunities',
      value: activeLeads,
      detail: 'New through negotiation',
      Icon: BriefcaseBusiness,
      tone: 'blue',
    },
    {
      label: 'Conversion rate',
      value: totals.conversionRate === null ? '—' : `${totals.conversionRate}%`,
      detail: 'Of leads with a final outcome',
      Icon: BarChart3,
      tone: 'amber',
    },
    {
      label: 'Pending follow-ups',
      value: totals.pendingTasks || 0,
      detail: `${totals.overdueTasks || 0} currently overdue`,
      Icon: CheckSquare2,
      tone: (totals.overdueTasks || 0) ? 'amber' : 'green',
    },
  ];
  const priorityMetricLabels = new Set(['Total leads', 'Customers', 'Revenue booked', 'Open pipeline', 'Pending follow-ups']);
  const priorityMetrics = metrics.filter(({ label }) => priorityMetricLabels.has(label));
  const supportingMetrics = metrics.filter(({ label }) => !priorityMetricLabels.has(label));

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-copy">
          <div className="dashboard-overline"><Sparkles size={14} /> SALES WORKSPACE</div>
          <h1>{greetingFor(today.getHours())}, {firstName}<span className="greeting-comma">.</span></h1>
          <p>Here’s what’s happening across your customer relationships.</p>
        </div>
        <div className="dashboard-header-actions">
          <div className="dashboard-date"><CalendarDays size={16} /><span>{dateLabel}</span></div>
          <button className="dashboard-refresh" type="button" onClick={() => load(true)} disabled={refreshing} aria-label="Refresh dashboard">
            <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />
          </button>
          <Link to="/leads?create=1" className="dashboard-add-button"><Plus size={16} /> Create lead</Link>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="dashboard-section-heading">
        <div><span>BUSINESS OVERVIEW</span><p>Your most important numbers, in one place.</p></div>
        <span className="dashboard-section-date"><span /> Live workspace data</span>
      </div>

      <section className="dashboard-kpis" aria-label="Priority business metrics">
        {priorityMetrics.map(({ label, value, detail, Icon, tone }) => (
          <article className="dashboard-kpi" key={label}>
            <div className="dashboard-kpi-topline">
              <div className={`kpi-icon kpi-icon-${tone}`}><Icon size={17} /></div>
              <div className="dashboard-kpi-label">{label}</div>
            </div>
            <div className="dashboard-kpi-value">{value}</div>
            <div className="dashboard-kpi-detail">{detail}</div>
          </article>
        ))}
      </section>

      <section className="dashboard-supporting-metrics" aria-label="Additional performance metrics">
        <div className="dashboard-supporting-heading">
          <div><span>PERFORMANCE SIGNALS</span><p>More context to help guide your next move.</p></div>
        </div>
        <div className="dashboard-support-grid">
          {supportingMetrics.map(({ label, value, detail, Icon, tone }) => (
            <article className="dashboard-support-card" key={label}>
              <div className={`dashboard-support-icon kpi-icon-${tone}`}><Icon size={15} /></div>
              <div className="dashboard-support-copy">
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-primary-grid">
        <article className="dashboard-panel pipeline-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="panel-eyebrow">SALES OVERVIEW</span>
              <h2>Pipeline health</h2>
              <p>Track every opportunity from first contact to close.</p>
            </div>
            <Link to="/pipeline" className="panel-link">Open pipeline <ArrowRight size={14} /></Link>
          </div>

          <div className="pipeline-summary">
            <div><strong>{pipelineTotal}</strong><span>total opportunities</span></div>
            <div className="pipeline-summary-divider" />
            <div><strong>{activeLeads}</strong><span>in progress</span></div>
            <div className="pipeline-summary-status">
              <span className={`status-pulse${overdueTasks ? ' status-pulse-warn' : ''}`} />
              {overdueTasks ? `${overdueTasks} follow-up${overdueTasks === 1 ? '' : 's'} overdue` : 'Follow-ups on track'}
            </div>
          </div>

          <div className="pipeline-stage-list">
            {STAGES.map((stage) => {
              const count = byStage[stage] || 0;
              const width = pipelineTotal ? Math.max((count / pipelineTotal) * 100, count ? 3 : 0) : 0;
              return (
                <div className="pipeline-stage" key={stage}>
                  <div className="pipeline-stage-label">
                    <span className={`stage-indicator stage-indicator-${stageClass[stage]}`} />
                    <span>{stage}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="pipeline-track" role="progressbar" aria-label={`${stage} opportunities`} aria-valuemin="0" aria-valuemax={pipelineTotal || 1} aria-valuenow={count}>
                    <span className={`pipeline-fill pipeline-fill-${stageClass[stage]}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {pipelineTotal === 0 && (
            <div className="pipeline-empty">
              <span className="pipeline-empty-icon"><Target size={17} /></span>
              <div><strong>Your pipeline starts here</strong><span>Add a lead to see opportunities move through each stage.</span></div>
              <Link to="/leads" aria-label="Add your first lead"><ArrowRight size={17} /></Link>
            </div>
          )}
        </article>

        <article className="dashboard-panel tasks-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="panel-eyebrow">STAY ON TOP OF IT</span>
              <h2>Upcoming follow-ups</h2>
              <p>{totals.pendingTasks} open task{totals.pendingTasks === 1 ? '' : 's'} need your attention.</p>
            </div>
            <Link to="/tasks" className="panel-link">View all <ArrowRight size={14} /></Link>
          </div>

          <div className="task-priority-summary">
            <div className="task-summary-cell"><Clock3 size={15} /><span>Open</span><strong>{totals.pendingTasks}</strong></div>
            <div className={`task-summary-cell${overdueTasks ? ' task-summary-overdue' : ''}`}>
              <CircleAlert size={15} /><span>Overdue</span><strong>{overdueTasks}</strong>
            </div>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="dashboard-empty">
              <span className="dashboard-empty-icon"><CheckSquare2 size={19} /></span>
              <strong>Nothing on your follow-up list</strong>
              <span>Create a task to keep the next step moving.</span>
              <Link to="/tasks" className="panel-link">Create a task <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <ul className="upcoming-task-list">
              {upcomingTasks.map((task) => {
                const isOverdue = task.status !== 'Completed' && new Date(task.dueDate) < new Date();
                return (
                  <li key={task._id}>
                    <span className={`task-check${task.status === 'Completed' ? ' task-check-done' : ''}`}>
                      {task.status === 'Completed' && <Check size={12} />}
                    </span>
                    <div className="upcoming-task-copy">
                      <strong>{task.title}</strong>
                      <span>
                        {task.lead ? <Link to={`/leads/${task.lead._id}`}>{task.lead.name}</Link> : 'General follow-up'}
                        {isManager && task.assignedTo?.name ? ` · ${task.assignedTo.name}` : ''}
                      </span>
                    </div>
                    <div className="upcoming-task-meta">
                      <span className={`task-due${isOverdue ? ' task-due-overdue' : ''}`}>{isOverdue ? 'Overdue' : fmtDate(task.dueDate)}</span>
                      <span className={`badge prio-${task.priority}`}>{task.priority}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel activity-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="panel-eyebrow">TEAM MOMENTUM</span>
              <h2>Recent activity</h2>
              <p>Latest updates from your customer workspace.</p>
            </div>
            <span className="activity-live-label"><span /> Live</span>
          </div>
          {recentActivity.length === 0 ? (
            <div className="dashboard-empty dashboard-empty-compact">
              <span className="dashboard-empty-icon"><MessageSquareText size={18} /></span>
              <strong>Your activity feed is ready</strong>
              <span>New leads and customer updates will appear here.</span>
            </div>
          ) : (
            <ul className="activity-feed">
              {recentActivity.slice(0, 6).map((activity) => {
                const meta = activityMeta[activity.type] || { label: activity.type, Icon: ArrowUpRight };
                const Icon = meta.Icon;
                return (
                  <li key={activity._id}>
                    <span className="activity-icon"><Icon size={15} /></span>
                    <div className="activity-copy">
                      <p>
                        <strong>{activity.user ? activity.user.name : 'A team member'}</strong> {meta.label}
                        {activity.lead && <> on <Link to={`/leads/${activity.lead._id}`}>{activity.lead.name}</Link></>}
                      </p>
                      {activity.notes && <span>{activity.notes}</span>}
                    </div>
                    <time>{fmtDateTime(activity.createdAt)}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="dashboard-panel workspace-panel">
          <div className="workspace-card-banner">
            <div className="workspace-banner-orb"><ShieldCheck size={22} /></div>
            <span>YOUR CRM AT A GLANCE</span>
            <h2>Relationships first.<br />Results follow.</h2>
            <p>Keep customer context, follow-ups, and opportunities connected in one place.</p>
          </div>
          <div className="workspace-links">
            <Link to="/leads"><span className="workspace-link-icon"><UsersRound size={16} /></span><span><strong>Manage leads</strong><small>Review your opportunities</small></span><ArrowRight size={15} /></Link>
            <Link to="/pipeline"><span className="workspace-link-icon workspace-link-blue"><BarChart3 size={16} /></span><span><strong>Sales pipeline</strong><small>See where deals stand</small></span><ArrowRight size={15} /></Link>
            {isManager && (
              <Link to="/reports"><span className="workspace-link-icon workspace-link-green"><ArrowDownRight size={16} /></span><span><strong>Team reports</strong><small>Explore team performance</small></span><ArrowRight size={15} /></Link>
            )}
          </div>
          <div className="workspace-role"><span className="workspace-role-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{ROLE_LABELS[user.role]}</small></span><span className="workspace-role-dot" /></div>
        </article>
        <article className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span className="panel-eyebrow">CUSTOMER RELATIONSHIPS</span><h2>Recently added customers</h2><p>Keep new customer records moving forward.</p></div><Link to="/contacts" className="panel-link">View all <ArrowRight size={14} /></Link></div>
          {recentCustomers.length === 0 ? <div className="dashboard-empty"><span className="dashboard-empty-icon"><UsersRound size={18} /></span><strong>No customer records yet</strong><span>Convert a qualified lead or create a customer record.</span></div> : <ul className="upcoming-task-list">{recentCustomers.map((contact) => <li key={contact._id}><span className="workspace-link-icon workspace-link-green"><ContactRound size={16} /></span><div className="upcoming-task-copy"><strong><Link to={`/contacts/${contact._id}`}>{contact.name}</Link></strong><span>{[contact.organization, contact.assignedTo?.name].filter(Boolean).join(' · ') || 'No company or owner set'}</span></div><span className={`badge ${contact.status === 'Active' || !contact.status ? 'on' : contact.status === 'At Risk' ? 'prio-High' : 'off'}`}>{contact.status || 'Active'}</span></li>)}</ul>}
        </article>
        <article className="dashboard-panel"><div className="dashboard-panel-heading"><div><span className="panel-eyebrow">CALENDAR</span><h2>Upcoming meetings</h2><p>Scheduled customer conversations.</p></div><Link to="/tasks" className="panel-link">Open tasks <ArrowRight size={14} /></Link></div>{upcomingMeetings.length === 0 ? <div className="dashboard-empty"><span className="dashboard-empty-icon"><CalendarDays size={18} /></span><strong>No upcoming meetings</strong><span>Schedule one from the Tasks page.</span></div> : <ul className="upcoming-task-list">{upcomingMeetings.map((meeting) => <li key={meeting._id}><span className="workspace-link-icon workspace-link-blue"><CalendarDays size={16} /></span><div className="upcoming-task-copy"><strong>{meeting.title}</strong><span>{meeting.lead?.name || 'General meeting'}</span></div><span className="task-due">{fmtDate(meeting.dueDate)}</span></li>)}</ul>}</article>
      </section>
    </div>
  );
}
