import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Plus, Search, Upload } from 'lucide-react';
import api, { errMsg, fmtDate, fmtMoney, STAGES, SOURCES } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Empty, Field, Modal, Pager, StageBadge } from '../components/ui.jsx';

const blank = { name: '', email: '', phone: '', organization: '', source: 'Website', notes: '', assignedTo: '', dealValue: 0, probability: 20, expectedCloseDate: '', priority: 'Medium' };
const csvColumns = ['name', 'email', 'phone', 'organization', 'source', 'stage', 'notes', 'dealValue', 'probability', 'expectedCloseDate', 'priority'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
        if (char === '\n') line += 1;
      }
    } else if (char === '"' && value.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\r' || char === '\n') {
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push({ cells: row, rowNumber: rowLine });
      row = [];
      value = '';
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      line += 1;
      rowLine = line;
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field');
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push({ cells: row, rowNumber: rowLine });
  if (rows.length < 2) throw new Error('CSV must include a header row and at least one lead');
  if (rows.length > 501) throw new Error('You can import up to 500 leads at a time');

  const headers = rows[0].cells.map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase());
  const nameColumn = headers.indexOf('name');
  if (nameColumn === -1) throw new Error('CSV must include a "name" column');

  return rows.slice(1).map(({ cells, rowNumber }) => {
    const lead = { rowNumber };
    csvColumns.forEach((column) => {
      const columnIndex = headers.indexOf(column);
      if (columnIndex !== -1 && cells[columnIndex] !== undefined) lead[column] = cells[columnIndex].trim();
    });
    return lead;
  });
}

function csvCell(value) {
  const text = String(value || '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function Leads() {
  const { isManager } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInput = useRef(null);
  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ q: '', stage: '', source: '', priority: '', assignedTo: '', sort: 'newest' });
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const [importState, setImportState] = useState(null);
  const [transferError, setTransferError] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (page = 1) => {
      try {
        const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
        const { data } = await api.get('/leads', { params });
        setLeads(data.leads);
        setMeta({ page: data.page, pages: data.pages, total: data.total });
        setError('');
      } catch (e) {
        setError(errMsg(e));
      }
    },
    [filters]
  );

  // Debounce filter changes so search doesn't fire on every keystroke
  useEffect(() => {
    const t = setTimeout(() => load(1), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (isManager) api.get('/users', { params: { active: 'true' } }).then((r) => setTeam(r.data.users)).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const body = { ...form };
      if (!body.assignedTo) delete body.assignedTo;
      await api.post('/leads', body);
      setShowForm(false);
      setForm(blank);
      load(1);
    } catch (err) {
      setFormError(errMsg(err));
    }
  };

  const exportCsv = async () => {
    setTransferError('');
    setExporting(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const firstPage = await api.get('/leads', { params: { ...params, page: 1, limit: 100 } });
      const allLeads = [...firstPage.data.leads];
      for (let page = 2; page <= firstPage.data.pages; page += 1) {
        const { data } = await api.get('/leads', { params: { ...params, page, limit: 100 } });
        allLeads.push(...data.leads);
      }

      const csv = [
        csvColumns.map(csvCell).join(','),
        ...allLeads.map((lead) => csvColumns.map((column) => csvCell(lead[column])).join(',')),
      ].join('\r\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setTransferError(errMsg(error));
    } finally {
      setExporting(false);
    }
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTransferError('');
    setImportState(null);
    setImporting(true);
    let created = 0;
    let rejected = 0;
    let errors = [];
    let hasChanges = false;
    let processed = false;
    try {
      const importedLeads = parseCsv(await file.text());
      for (let start = 0; start < importedLeads.length; start += 20) {
        const batch = importedLeads.slice(start, start + 20);
        const { data } = await api.post('/leads/import', { leads: batch });
        processed = true;
        created += data.created;
        rejected += data.rejected;
        errors = errors.concat(data.errors);
        hasChanges = hasChanges || data.created > 0;
      }
      setImportState({ created, rejected, errors });
    } catch (error) {
      if (processed) {
        setImportState({ created, rejected, errors });
        setTransferError(`Import stopped after processing ${created + rejected} row${created + rejected === 1 ? '' : 's'} (${created} created). Remaining rows were not processed: ${errMsg(error)}`);
      } else {
        setTransferError(errMsg(error));
      }
    } finally {
      if (hasChanges) await load(1);
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div>
      <div className="page-head">
        <h2>Leads</h2>
        <div className="lead-actions">
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="visually-hidden" onChange={importCsv} />
          <button className="btn" type="button" onClick={() => fileInput.current?.click()} disabled={importing}>
            <Upload size={15} /> {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <button className="btn" type="button" onClick={exportCsv} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button className="btn primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New lead
          </button>
        </div>
      </div>

      <Alert>{transferError}</Alert>
      {importState && (
        <div className="lead-import-result">
          <Alert kind={importState.rejected ? 'error' : 'ok'}>
            Imported {importState.created} lead{importState.created === 1 ? '' : 's'}; {importState.rejected} row{importState.rejected === 1 ? '' : 's'} skipped.
          </Alert>
          {importState.errors.length > 0 && (
            <ul>
              {importState.errors.map((item, index) => <li key={`${item.row}-${index}`}>Row {item.row}: {item.message}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="card toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search name, organization, email, phone" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
        <select value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} aria-label="Filter by priority">
          <option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option>
        </select>
        {isManager && <select value={filters.assignedTo} onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })} aria-label="Filter by owner">
          <option value="">All owners</option><option value="unassigned">Unassigned</option>{team.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
        </select>}
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} aria-label="Sort leads"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="value">Highest value</option><option value="closeDate">Expected close date</option><option value="probability">Highest win chance</option></select>
      </div>

      <Alert>{error}</Alert>
      <div className="card table-wrap">
        {leads.length === 0 ? (
          <Empty>No leads match your filters.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Organization</th>
                <th>Source</th>
                <th>Stage</th>
                <th>Deal value</th>
                <th>Win chance</th>
                <th>Lead score</th>
                <th>Priority</th>
                <th>Close date</th>
                <th>Assigned to</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l._id}>
                  <td>
                    <Link to={`/leads/${l._id}`}>{l.name}</Link>
                    <div className="muted small">{l.email}</div>
                  </td>
                  <td>{l.organization || '—'}</td>
                  <td>{l.source}</td>
                  <td>
                    <StageBadge stage={l.stage} />
                  </td>
                  <td>{fmtMoney(l.dealValue)}</td>
                  <td>{l.probability ?? 20}%</td>
                  <td><span className={`score-pill ${(l.score || 0) >= 70 ? 'score-high' : (l.score || 0) >= 40 ? 'score-medium' : 'score-low'}`}>{l.score ?? 10}</span></td>
                  <td><span className={`badge prio-${(l.priority || 'Medium').toLowerCase()}`}>{l.priority || 'Medium'}</span></td>
                  <td>{l.expectedCloseDate ? fmtDate(l.expectedCloseDate) : <span className="muted">Not set</span>}</td>
                  <td>{l.assignedTo ? l.assignedTo.name : <span className="muted">Unassigned</span>}</td>
                  <td>{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pager page={meta.page} pages={meta.pages} onChange={load} />

      {showForm && (
        <Modal title="New lead" onClose={() => setShowForm(false)}>
          <form onSubmit={submit} className="form-grid">
            <Alert>{formError}</Alert>
            <Field label="Name *">
              <input value={form.name} onChange={set('name')} required />
            </Field>
            <Field label="Organization">
              <input value={form.organization} onChange={set('organization')} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Source">
              <select value={form.source} onChange={set('source')}>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label={`Estimated deal value (${localStorage.getItem('crm_currency') || 'USD'})`}><input type="number" min="0" step="100" value={form.dealValue} onChange={set('dealValue')} /></Field>
            <Field label="Win probability (%)"><input type="number" min="0" max="100" value={form.probability} onChange={set('probability')} /></Field>
            <Field label="Expected close date"><input type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} /></Field>
            <Field label="Priority"><select value={form.priority} onChange={set('priority')}><option>Low</option><option>Medium</option><option>High</option></select></Field>
            {isManager && (
              <Field label="Assign to">
                <select value={form.assignedTo} onChange={set('assignedTo')}>
                  <option value="">Unassigned</option>
                  {team.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Notes">
              <textarea rows="3" value={form.notes} onChange={set('notes')} />
            </Field>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn primary">Save lead</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
