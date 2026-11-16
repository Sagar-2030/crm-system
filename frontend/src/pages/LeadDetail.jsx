import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg, fmtDate, fmtDateTime, fmtMoney, STAGES, SOURCES, TASK_STATUSES, toInputDate } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Empty, StageBadge } from '../components/ui.jsx';

const ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting'];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const [data, setData] = useState(null);
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState({ type: 'note', notes: '' });
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '' });
  const [edit, setEdit] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/leads/${id}`);
      setData(data);
      setEditForm({ name: data.lead.name || '', email: data.lead.email || '', phone: data.lead.phone || '', organization: data.lead.organization || '', source: data.lead.source || 'Other', notes: data.lead.notes || '', dealValue: data.lead.dealValue || 0, probability: data.lead.probability ?? 20, expectedCloseDate: toInputDate(data.lead.expectedCloseDate), priority: data.lead.priority || 'Medium' });
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isManager) api.get('/users', { params: { active: 'true' } }).then((r) => setTeam(r.data.users)).catch(() => {});
  }, [isManager]);

  const run = async (fn) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (error && !data) return <Alert>{error}</Alert>;
  if (!data) return <p className="muted">Loading…</p>;

  const { lead, activities, tasks, contacts } = data;

  return (
    <div>
      <Link to="/leads" className="link">
        ← Back to leads
      </Link>
      <div className="page-head">
        <div>
          <h2>{lead.name}</h2>
          <div className="muted">{lead.organization || 'No organization'}</div>
        </div>
        <div className="lead-actions"><StageBadge stage={lead.stage} /><button className="btn" type="button" onClick={() => setEdit((value) => !value)}>{edit ? 'Cancel edit' : 'Edit record'}</button>{lead.stage === 'Converted' ? <Link className="btn" to={contacts[0] ? `/contacts/${contacts[0]._id}` : '/contacts'}>Open customer</Link> : <button className="btn primary" type="button" onClick={async () => { try { const response = await api.post(`/leads/${id}/convert`); navigate(`/contacts/${response.data.contact._id}`); } catch (e) { setError(errMsg(e)); } }}>Convert to customer</button>}</div>
      </div>
      <Alert>{error}</Alert>

      <div className="grid-2">
        <div className="card">
          <h3>Opportunity details</h3>
          {edit ? <form className="form-grid" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.patch(`/leads/${id}`, editForm); setEdit(false); }); }}>
            {(isManager ? ['name', 'organization', 'email', 'phone'] : ['organization', 'email', 'phone']).map((key) => <label className="field" key={key}><span>{key[0].toUpperCase() + key.slice(1)}</span><input type={key === 'email' ? 'email' : 'text'} value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} /></label>)}
            {isManager && <label className="field"><span>Source</span><select value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}>{SOURCES.map((source) => <option key={source}>{source}</option>)}</select></label>}
            <label className="field"><span>Estimated deal value ({localStorage.getItem('crm_currency') || 'USD'})</span><input type="number" min="0" step="100" value={editForm.dealValue} onChange={(e) => setEditForm({ ...editForm, dealValue: e.target.value })} /></label>
            <label className="field"><span>Win probability (%)</span><input type="number" min="0" max="100" value={editForm.probability} onChange={(e) => setEditForm({ ...editForm, probability: e.target.value })} /></label>
            <label className="field"><span>Expected close date</span><input type="date" value={editForm.expectedCloseDate} onChange={(e) => setEditForm({ ...editForm, expectedCloseDate: e.target.value })} /></label>
            <label className="field"><span>Priority</span><select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label className="field"><span>Notes</span><textarea rows="3" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></label>
            <button className="btn primary">Save changes</button>
          </form> : <>
          <dl className="details">
            <dt>Deal value</dt><dd>{fmtMoney(lead.dealValue)}</dd>
            <dt>Weighted forecast</dt><dd>{fmtMoney((lead.dealValue || 0) * (lead.probability || 0) / 100)} <span className="muted small">({lead.probability || 0}% probability)</span></dd>
            <dt>Expected close</dt><dd>{lead.expectedCloseDate ? fmtDate(lead.expectedCloseDate) : 'Not set'}</dd>
            <dt>Priority</dt><dd><span className={`badge prio-${(lead.priority || 'Medium').toLowerCase()}`}>{lead.priority || 'Medium'}</span></dd>
            <dt>Email</dt>
            <dd>{lead.email || '—'}</dd>
            <dt>Phone</dt>
            <dd>{lead.phone || '—'}</dd>
            <dt>Source</dt>
            <dd>{lead.source}</dd>
            <dt>Created</dt>
            <dd>{fmtDate(lead.createdAt)}</dd>
            <dt>Notes</dt>
            <dd>{lead.notes || '—'}</dd>
          </dl>

          <div className="inline-controls">
            <label className="field">
              <span>Pipeline stage</span>
              <select value={lead.stage} onChange={(e) => run(() => api.patch(`/leads/${id}/stage`, { stage: e.target.value }))}>
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {isManager ? (
              <label className="field">
                <span>Assigned to</span>
                <select
                  value={lead.assignedTo ? lead.assignedTo._id : ''}
                  onChange={(e) => e.target.value && run(() => api.patch(`/leads/${id}/assign`, { assignedTo: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {team.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="field">
                <span>Assigned to</span>
                <div>{lead.assignedTo ? lead.assignedTo.name : '—'}</div>
              </div>
            )}
          </div>
          </>}

          {isManager && (
            <button
              className="btn danger"
              onClick={() => {
                if (window.confirm('Delete this lead and its tasks and activity?')) run(async () => { await api.delete(`/leads/${id}`); navigate('/leads'); });
              }}
            >
              Delete lead
            </button>
          )}

          {contacts.length > 0 && (
            <>
              <h4>Linked contacts</h4>
              <ul className="list">
                {contacts.map((c) => (
                  <li key={c._id}>
                    {c.name} <span className="muted small">{c.email || c.phone}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card">
          <h3>Follow-up tasks</h3>
          {tasks.length === 0 ? (
            <Empty>No tasks for this lead.</Empty>
          ) : (
            <ul className="list">
              {tasks.map((t) => (
                <li key={t._id}>
                  <div>
                    <strong>{t.title}</strong>
                    <div className="muted small">
                      Due {fmtDate(t.dueDate)} · {t.assignedTo ? t.assignedTo.name : ''}
                    </div>
                  </div>
                  <select value={t.status} onChange={(e) => run(() => api.patch(`/tasks/${t._id}`, { status: e.target.value }))}>
                    {TASK_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api.post('/tasks', { ...taskForm, lead: id, assignedTo: lead.assignedTo ? lead.assignedTo._id : undefined });
                setTaskForm({ title: '', dueDate: '' });
              });
            }}
          >
            <input placeholder="New follow-up task" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
            <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} required />
            <button className="btn primary">Add</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>Interaction history</h3>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.post(`/leads/${id}/activities`, note);
              setNote({ type: 'note', notes: '' });
            });
          }}
        >
          <select value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input placeholder="Add a note or log an interaction" value={note.notes} onChange={(e) => setNote({ ...note, notes: e.target.value })} required />
          <button className="btn primary">Log</button>
        </form>
        {activities.length === 0 ? (
          <Empty>No activity recorded.</Empty>
        ) : (
          <ul className="timeline">
            {activities.map((a) => (
              <li key={a._id}>
                <span className="tl-type">{a.type.replace('_', ' ')}</span>
                <div>{a.notes}</div>
                <div className="muted small">
                  {a.user ? a.user.name : 'Unknown'} · {fmtDateTime(a.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
