import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2 } from 'lucide-react';
import api, { errMsg, fmtDate, PRIORITIES, TASK_STATUSES } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Empty, Field, Modal, Pager } from '../components/ui.jsx';

const blank = { title: '', description: '', dueDate: '', priority: 'Medium', type: 'Follow-up', lead: '', assignedTo: '' };

export default function Tasks() {
  const { isManager } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [filter, setFilter] = useState(() => searchParams.get('filter') || '');
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const urlFilter = searchParams.get('filter') || '';
  const urlQuery = searchParams.get('q') || '';

  useEffect(() => {
    setFilter(TASK_STATUSES.includes(urlFilter) || urlFilter === 'overdue' ? urlFilter : '');
  }, [urlFilter]);

  useEffect(() => {
    setQ(urlQuery);
  }, [urlQuery]);
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setForm(blank);
      setFormError('');
      setShow(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const load = useCallback(
    async (page = 1) => {
      try {
        const params = { page };
        if (q) params.q = q;
        if (filter === 'overdue') params.overdue = 'true';
        else if (filter) params.status = filter;
        const { data } = await api.get('/tasks', { params });
        setTasks(data.tasks);
        setMeta({ page: data.page, pages: data.pages });
        setError('');
      } catch (e) {
        setError(errMsg(e));
      }
    },
    [filter, q]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    api.get('/leads/board').then((r) => setLeads(r.data.leads)).catch(() => {});
    if (isManager) api.get('/users', { params: { active: 'true' } }).then((r) => setTeam(r.data.users)).catch(() => {});
  }, [isManager]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const body = { ...form };
      if (!body.lead) delete body.lead;
      if (!body.assignedTo) delete body.assignedTo;
      await api.post('/tasks', body);
      setShow(false);
      setForm(blank);
      load(1);
    } catch (err) {
      setFormError(errMsg(err));
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/tasks/${id}`, { status });
      load(meta.page);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      load(meta.page);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const isOverdue = (t) => t.status !== 'Completed' && new Date(t.dueDate) < new Date();

  return (
    <div>
      <div className="page-head">
        <h2>Tasks</h2>
        <button className="btn primary" onClick={() => setShow(true)}>
          <Plus size={16} /> New task
        </button>
      </div>
      <div className="card toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search task title or description" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All tasks</option>
          {TASK_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
          <option value="overdue">Overdue</option>
        </select>
      </div>
      <Alert>{error}</Alert>
      <div className="card table-wrap">
        {tasks.length === 0 ? (
          <Empty>No tasks found.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Lead</th>
                <th>Assigned to</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Type</th>
                <th>Status</th>
                {isManager && <th />}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t._id}>
                  <td>
                    <strong>{t.title}</strong>
                    {t.description && <div className="muted small">{t.description}</div>}
                  </td>
                  <td>{t.lead ? <Link to={`/leads/${t.lead._id}`}>{t.lead.name}</Link> : '—'}</td>
                  <td>{t.assignedTo ? t.assignedTo.name : '—'}</td>
                  <td className={isOverdue(t) ? 'overdue' : ''}>{fmtDate(t.dueDate)}</td>
                  <td>
                    <span className={`badge prio-${t.priority}`}>{t.priority}</span>
                  </td>
                  <td>{t.type || 'Follow-up'}</td>
                  <td>
                    <select value={t.status} onChange={(e) => setStatus(t._id, e.target.value)}>
                      {TASK_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  {isManager && (
                    <td>
                      <button className="icon-btn" onClick={() => remove(t._id)} aria-label="Delete task">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pager page={meta.page} pages={meta.pages} onChange={load} />

      {show && (
        <Modal title="New task" onClose={() => setShow(false)}>
          <form onSubmit={submit} className="form-grid">
            <Alert>{formError}</Alert>
            <Field label="Title *">
              <input value={form.title} onChange={set('title')} required />
            </Field>
            <Field label="Description">
              <textarea rows="2" value={form.description} onChange={set('description')} />
            </Field>
            <Field label="Due date *">
              <input type="date" value={form.dueDate} onChange={set('dueDate')} required />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Activity type"><select value={form.type} onChange={set('type')}><option>Follow-up</option><option>Meeting</option><option>Call</option><option>Email</option></select></Field>
            <Field label="Related lead">
              <select value={form.lead} onChange={set('lead')}>
                <option value="">None</option>
                {leads.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            {isManager && (
              <Field label="Assign to">
                <select value={form.assignedTo} onChange={set('assignedTo')}>
                  <option value="">Myself</option>
                  {team.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button className="btn primary">Save task</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
