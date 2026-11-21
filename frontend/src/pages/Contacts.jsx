import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Edit3, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api, { errMsg, fmtMoney } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Link } from 'react-router-dom';
import { Alert, Empty, Field, Modal, Pager } from '../components/ui.jsx';

const blank = { name: '', email: '', phone: '', organization: '', lead: '', category: 'Customer', status: 'Active', industry: '', lifetimeValue: 0, monthlyRecurringRevenue: 0, tags: '', notes: '', assignedTo: '' };

function parseCustomerCsv(text) {
  const rows = []; let row = []; let value = ''; let quoted = false; let line = 1; let rowLine = 1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) { if (char === '"' && text[i + 1] === '"') { value += '"'; i += 1; } else if (char === '"') quoted = false; else { value += char; if (char === '\n') line += 1; } }
    else if (char === '"' && !value.length) quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\r' || char === '\n') { row.push(value); if (row.some((cell) => cell.trim())) rows.push({ cells: row, rowNumber: rowLine }); row = []; value = ''; if (char === '\r' && text[i + 1] === '\n') i += 1; line += 1; rowLine = line; }
    else value += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field');
  row.push(value); if (row.some((cell) => cell.trim())) rows.push({ cells: row, rowNumber: rowLine });
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one customer');
  if (rows.length > 501) throw new Error('You can import up to 500 customers at a time');
  const headers = rows[0].cells.map((cell) => cell.replace(/^\uFEFF/, '').trim().toLowerCase());
  if (!headers.includes('name')) throw new Error('CSV must include a name column');
  return rows.slice(1).map(({ cells, rowNumber }) => ({ rowNumber, ...Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])) }));
}

export default function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isManager } = useAuth();
  const fileInput = useRef(null);
  const [contacts, setContacts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [filters, setFilters] = useState({ status: '', category: '', assignedTo: '', sort: 'newest' });
  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState('');
  const [importing, setImporting] = useState(false);
  const [importState, setImportState] = useState(null);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const urlQuery = searchParams.get('q') || '';

  useEffect(() => setQ(urlQuery), [urlQuery]);
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setEditing('');
      setForm(blank);
      setFormError('');
      setShow(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const load = useCallback(async (page = 1) => {
    try {
      const { data } = await api.get('/contacts', { params: { page, ...filters, ...(q ? { q } : {}) } });
      setContacts(data.contacts); setMeta({ page: data.page, pages: data.pages, total: data.total }); setError('');
    } catch (e) { setError(errMsg(e)); }
  }, [q, filters]);
  useEffect(() => { const timer = setTimeout(() => load(1), 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { api.get('/leads/board').then((r) => setLeads(r.data.leads)).catch(() => {}); }, []);
  useEffect(() => { if (isManager) api.get('/users', { params: { active: 'true' } }).then((r) => setTeam(r.data.users)).catch(() => {}); }, [isManager]);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault(); setFormError('');
    try {
      const body = { ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) };
      if (!body.lead) delete body.lead;
      if (!body.assignedTo) delete body.assignedTo;
      if (editing) await api.patch(`/contacts/${editing}`, body); else await api.post('/contacts', body);
      setShow(false); setEditing(''); setForm(blank); await load(1);
    } catch (e) { setFormError(errMsg(e)); }
  };

  const editContact = (contact) => {
    setEditing(contact._id);
    setForm({ name: contact.name || '', email: contact.email || '', phone: contact.phone || '', organization: contact.organization || '', lead: contact.lead?._id || '', category: contact.category || 'Customer', status: contact.status || 'Active', industry: contact.industry || '', lifetimeValue: contact.lifetimeValue || 0, monthlyRecurringRevenue: contact.monthlyRecurringRevenue || 0, tags: (contact.tags || []).join(', '), notes: contact.notes || '', assignedTo: contact.assignedTo?._id || '' });
    setFormError(''); setShow(true);
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this customer record?')) return;
    try { await api.delete(`/contacts/${id}`); await load(meta.page); } catch (e) { setError(errMsg(e)); }
  };

  const exportCsv = async () => {
    try {
      const params = { ...filters, ...(q ? { q } : {}) };
      const first = await api.get('/contacts', { params: { ...params, page: 1, limit: 100 } });
      const rows = [...first.data.contacts];
      for (let page = 2; page <= first.data.pages; page += 1) rows.push(...(await api.get('/contacts', { params: { ...params, page, limit: 100 } })).data.contacts);
      const columns = ['name', 'email', 'phone', 'organization', 'industry', 'category', 'status', 'lifetimeValue', 'monthlyRecurringRevenue', 'tags', 'notes'];
      const cell = (value) => { const text = String(value ?? ''); const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };
      const csv = [columns.map(cell).join(','), ...rows.map((record) => columns.map((key) => cell(Array.isArray(record[key]) ? record[key].join('; ') : record[key])).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(errMsg(e)); }
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    setImporting(true); setImportState(null); setError('');
    let created = 0; let rejected = 0; let errors = [];
    try {
      const rows = parseCustomerCsv(await file.text());
      for (let start = 0; start < rows.length; start += 20) {
        const { data } = await api.post('/contacts/import', { contacts: rows.slice(start, start + 20) });
        created += data.created; rejected += data.rejected; errors = errors.concat(data.errors);
      }
      setImportState({ created, rejected, errors }); await load(1);
    } catch (e) { setError(errMsg(e)); }
    finally { setImporting(false); event.target.value = ''; }
  };

  return <div>
    <div className="page-head"><div><h2>Customers & contacts</h2><p className="muted small">{meta.total} records · customer profiles, ownership, and lifetime value</p></div><div className="lead-actions"><input ref={fileInput} type="file" accept=".csv,text/csv" className="visually-hidden" onChange={importCsv} /><button className="btn" onClick={() => fileInput.current?.click()} disabled={importing}><Upload size={15} /> {importing ? 'Importing…' : 'Import CSV'}</button><button className="btn" onClick={exportCsv}><Download size={15} /> Export CSV</button><button className="btn primary" onClick={() => { setEditing(''); setForm(blank); setFormError(''); setShow(true); }}><Plus size={16} /> New customer</button></div></div>
    {importState && <div className="lead-import-result"><Alert kind={importState.rejected ? 'error' : 'ok'}>Imported {importState.created} customer{importState.created === 1 ? '' : 's'}; {importState.rejected} row{importState.rejected === 1 ? '' : 's'} skipped.</Alert>{importState.errors.length > 0 && <ul>{importState.errors.map((item, index) => <li key={`${item.row}-${index}`}>Row {item.row}: {item.message}</li>)}</ul>}</div>}
    <div className="card toolbar"><div className="search"><Search size={16} /><input placeholder="Search customers, company, email, phone" value={q} onChange={(e) => setQ(e.target.value)} /></div><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option><option>Customer</option><option>Prospect</option><option>Partner</option></select><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option><option>Active</option><option>At Risk</option><option>Inactive</option></select>{isManager && <select value={filters.assignedTo} onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}><option value="">All owners</option><option value="unassigned">Unassigned</option>{team.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select>}<select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="value">Highest lifetime value</option><option value="name">Name A–Z</option></select></div>
    <Alert>{error}</Alert>
    <div className="card table-wrap">{contacts.length === 0 ? <Empty>No customer records match these filters.</Empty> : <table><thead><tr><th>Contact</th><th>Company</th><th>Industry</th><th>Category / status</th><th>Lifetime value</th><th>Owner</th><th>Linked lead</th><th /></tr></thead><tbody>{contacts.map((c) => <tr key={c._id}><td><strong><Link to={`/contacts/${c._id}`}>{c.name}</Link></strong><div className="muted small">{c.email || c.phone || 'No contact details'}</div>{c.tags?.length > 0 && <div className="muted small">{c.tags.join(' · ')}</div>}</td><td>{c.organization || '—'}</td><td>{c.industry || '—'}</td><td><span className="badge">{c.category || 'Customer'}</span><div><span className={`badge ${c.status === 'Active' ? 'on' : c.status === 'At Risk' ? 'prio-High' : 'off'}`}>{c.status || 'Active'}</span></div></td><td>{fmtMoney(c.lifetimeValue)}</td><td>{c.assignedTo?.name || <span className="muted">Unassigned</span>}</td><td>{c.lead?.name || '—'}</td><td><button className="icon-btn" onClick={() => editContact(c)} aria-label={`Edit ${c.name}`}><Edit3 size={15} /></button><button className="icon-btn" onClick={() => remove(c._id)} aria-label={`Delete ${c.name}`}><Trash2 size={15} /></button></td></tr>)}</tbody></table>}</div>
    <Pager page={meta.page} pages={meta.pages} onChange={load} />
    {show && <Modal title={editing ? 'Edit customer' : 'New customer'} onClose={() => { setShow(false); setEditing(''); }}><form onSubmit={submit} className="form-grid"><Alert>{formError}</Alert>
      <Field label="Name *"><input value={form.name} onChange={set('name')} required /></Field><Field label="Organization"><input value={form.organization} onChange={set('organization')} /></Field><Field label="Industry"><input value={form.industry} onChange={set('industry')} /></Field><Field label="Email"><input type="email" value={form.email} onChange={set('email')} /></Field><Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
      <Field label="Category"><select value={form.category} onChange={set('category')}><option>Customer</option><option>Prospect</option><option>Partner</option></select></Field><Field label="Status"><select value={form.status} onChange={set('status')}><option>Active</option><option>At Risk</option><option>Inactive</option></select></Field><Field label={`Lifetime value (${localStorage.getItem('crm_currency') || 'USD'})`}><input type="number" min="0" step="100" value={form.lifetimeValue} onChange={set('lifetimeValue')} /></Field><Field label={`Monthly recurring revenue (${localStorage.getItem('crm_currency') || 'USD'})`}><input type="number" min="0" step="10" value={form.monthlyRecurringRevenue} onChange={set('monthlyRecurringRevenue')} /></Field><Field label="Tags (comma separated)"><input value={form.tags} onChange={set('tags')} placeholder="Enterprise, Renewal Q4" /></Field>
      {isManager && <Field label="Assigned owner"><select value={form.assignedTo} onChange={set('assignedTo')}><option value="">Unassigned</option>{team.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></Field>}
      <Field label="Linked lead"><select value={form.lead} onChange={set('lead')}><option value="">None</option>{leads.map((lead) => <option key={lead._id} value={lead._id}>{lead.name}</option>)}</select></Field><Field label="Internal notes"><textarea rows="3" value={form.notes} onChange={set('notes')} /></Field>
      <div className="form-actions"><button type="button" className="btn" onClick={() => { setShow(false); setEditing(''); }}>Cancel</button><button className="btn primary">Save customer</button></div>
    </form></Modal>}
  </div>;
}
