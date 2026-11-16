import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api, { errMsg, fmtMoney, ROLE_LABELS } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Field, Modal } from '../components/ui.jsx';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const blank = { name: '', email: '', password: '', role: 'agent', department: 'Sales', jobTitle: 'Sales representative', monthlySalesTarget: 0 };

export default function Users() {
  const { user: me } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  useEffect(() => setQ(searchParams.get('q') || ''), [searchParams]);

  // Managers can only create agents; only a super admin can create other roles
  const roleOptions = me.role === 'superadmin' ? ['superadmin', 'manager', 'agent'] : ['agent'];

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/users', form);
      setShow(false);
      setForm(blank);
      load();
    } catch (err) {
      setFormError(errMsg(err));
    }
  };

  const patch = async (id, body) => {
    try {
      await api.patch(`/users/${id}`, body);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const canEdit = (u) => u._id !== me._id && (me.role === 'superadmin' || u.role === 'agent');
  const visibleUsers = users.filter((u) => [u.name, u.email, u.department, u.jobTitle].some((value) => String(value || '').toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <div className="page-head">
        <h2>User management</h2>
        <button className="btn primary" onClick={() => setShow(true)}>
          <Plus size={16} /> New user
        </button>
      </div>
      <div className="card toolbar"><div className="search"><Search size={16} /><input placeholder="Search employees" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <Alert>{error}</Alert>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department / title</th>
              <th>Monthly target</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {me.role === 'superadmin' && canEdit(u) ? (
                    <select value={u.role} onChange={(e) => patch(u._id, { role: e.target.value })}>
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABELS[u.role]
                  )}
                </td>
                <td><div>{u.department || 'Sales'}</div><small className="muted">{u.jobTitle || ROLE_LABELS[u.role]}</small></td>
                <td>{canEdit(u) ? <input aria-label={`Monthly sales target for ${u.name}`} type="number" min="0" defaultValue={u.monthlySalesTarget || 0} onBlur={(e) => { const value = Number(e.target.value); if (value !== (u.monthlySalesTarget || 0)) patch(u._id, { monthlySalesTarget: value }); }} /> : fmtMoney(u.monthlySalesTarget)}</td>
                <td>
                  <span className={`badge ${u.isActive ? 'on' : 'off'}`}>{u.isActive ? 'Active' : 'Disabled'}</span>
                </td>
                <td>
                  {canEdit(u) && (
                    <button className="btn" onClick={() => patch(u._id, { isActive: !u.isActive })}>
                      {u.isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <Modal title="New user" onClose={() => setShow(false)}>
          <form onSubmit={submit} className="form-grid">
            <Alert>{formError}</Alert>
            <Field label="Name *">
              <input value={form.name} onChange={set('name')} required />
            </Field>
            <Field label="Email *">
              <input type="email" value={form.email} onChange={set('email')} required />
            </Field>
            <Field label="Temporary password * (min 8 characters)">
              <input type="password" minLength={8} value={form.password} onChange={set('password')} required />
            </Field>
            <Field label="Department"><input value={form.department} onChange={set('department')} /></Field>
            <Field label="Job title"><input value={form.jobTitle} onChange={set('jobTitle')} /></Field>
            <Field label={`Monthly sales target (${localStorage.getItem('crm_currency') || 'USD'})`}><input type="number" min="0" value={form.monthlySalesTarget} onChange={set('monthlySalesTarget')} /></Field>
            <Field label="Role">
              <select value={form.role} onChange={set('role')}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button className="btn primary">Create user</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
