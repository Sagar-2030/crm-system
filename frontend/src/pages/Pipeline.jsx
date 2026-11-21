import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BriefcaseBusiness, LayoutGrid, List, Plus, Search, Target } from 'lucide-react';
import api, { errMsg, fmtDate, fmtMoney, STAGES } from '../api.js';
import { Alert, Empty } from '../components/ui.jsx';

const stageTone = {
  New: 'New', Contacted: 'Contacted', Qualified: 'Qualified',
  Proposal: 'Proposal', Negotiation: 'Negotiation',
  Converted: 'Converted', Lost: 'Lost',
};

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [view, setView] = useState('kanban');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/leads/board');
      setLeads(response.data.leads || []);
      setError('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const move = async (id, stage) => {
    const lead = leads.find((item) => item._id === id);
    if (!lead || lead.stage === stage) return;
    const previousStage = lead.stage;
    setLeads((current) => current.map((item) => item._id === id ? { ...item, stage } : item));
    try {
      await api.patch('/leads/' + id + '/stage', { stage });
      setError('');
    } catch (err) {
      setLeads((current) => current.map((item) => item._id === id ? { ...item, stage: previousStage } : item));
      setError(errMsg(err));
    }
  };

  const filteredLeads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStage = !stageFilter || lead.stage === stageFilter;
      const values = [lead.name, lead.organization, lead.email, lead.assignedTo && lead.assignedTo.name];
      const matchesQuery = !term || values.some((value) => String(value || '').toLowerCase().includes(term));
      return matchesStage && matchesQuery;
    });
  }, [leads, query, stageFilter]);

  const openLeads = leads.filter((lead) => !['Converted', 'Lost'].includes(lead.stage));
  const openValue = openLeads.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0);
  const weightedValue = openLeads.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0) * (Number(lead.probability == null ? 20 : lead.probability) / 100), 0);

  return (
    <div className="pipeline-page">
      <header className="pipeline-heading">
        <div>
          <h2>Sales pipeline</h2>
          <p>Move opportunities forward and keep every forecast grounded in your CRM data.</p>
        </div>
        <div className="pipeline-actions">
          <Link className="btn primary" to="/leads?create=1"><Plus size={15} /> New lead</Link>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      <section className="pipeline-stats" aria-label="Pipeline summary">
        <article className="pipeline-stat">
          <span className="pipeline-stat-icon"><BriefcaseBusiness size={17} /></span>
          <span className="pipeline-stat-copy"><span>Open opportunities</span><strong>{openLeads.length.toLocaleString()}</strong></span>
        </article>
        <article className="pipeline-stat">
          <span className="pipeline-stat-icon"><Target size={17} /></span>
          <span className="pipeline-stat-copy"><span>Open pipeline value</span><strong>{fmtMoney(openValue, { notation: 'compact', maximumFractionDigits: 1 })}</strong></span>
        </article>
        <article className="pipeline-stat">
          <span className="pipeline-stat-icon"><Activity size={17} /></span>
          <span className="pipeline-stat-copy"><span>Weighted forecast</span><strong>{fmtMoney(weightedValue, { notation: 'compact', maximumFractionDigits: 1 })}</strong></span>
        </article>
      </section>

      <section className="pipeline-toolbar" aria-label="Pipeline controls">
        <label className="pipeline-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, companies, owners…" aria-label="Search pipeline" />
        </label>
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} aria-label="Filter pipeline by stage">
          <option value="">All stages</option>
          {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
        <div className="pipeline-view-switch" role="group" aria-label="Pipeline layout">
          <button type="button" aria-pressed={view === 'kanban'} onClick={() => setView('kanban')}><LayoutGrid size={14} /> Board</button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}><List size={14} /> Table</button>
        </div>
      </section>

      {loading ? (
        <div className="pipeline-table-card"><div className="pipeline-empty-stage">Loading your sales pipeline…</div></div>
      ) : filteredLeads.length === 0 ? (
        <div className="pipeline-table-card"><Empty>{query || stageFilter ? 'No opportunities match these filters.' : 'Your pipeline is empty. Create a lead to start tracking opportunities.'}</Empty></div>
      ) : view === 'kanban' ? (
        <div className="pipeline-board-wrap">
          <div className="board">
            {STAGES.map((stage) => {
              const items = filteredLeads.filter((lead) => lead.stage === stage);
              const amount = items.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0);
              return (
                <section
                  key={stage}
                  className={'column' + (overStage === stage ? ' over' : '')}
                  aria-label={stage + ' stage'}
                  onDragOver={(event) => { event.preventDefault(); setOverStage(stage); }}
                  onDragLeave={(event) => { if (event.currentTarget === event.target) setOverStage(null); }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setOverStage(null);
                    if (dragId) move(dragId, stage);
                    setDragId(null);
                  }}
                >
                  <div className="column-head">
                    <span className={'badge stage-' + (stageTone[stage] || stage)}>{stage}</span>
                    <span className="muted">{items.length}</span>
                  </div>
                  {items.length > 0 && <div className="pipeline-column-total">{fmtMoney(amount, { notation: 'compact', maximumFractionDigits: 1 })}</div>}
                  {items.length === 0 ? (
                    <div className="pipeline-empty-stage">Drop an opportunity here</div>
                  ) : items.map((lead) => (
                    <article
                      key={lead._id}
                      className="pcard"
                      draggable
                      onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDragId(lead._id); }}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    >
                      <div className="pipeline-card-title">
                        <Link to={'/leads/' + lead._id}><strong>{lead.name}</strong></Link>
                        <span className={'badge prio-' + (lead.priority || 'Medium').toLowerCase()}>{lead.priority || 'Medium'}</span>
                      </div>
                      <div className="muted small">{lead.organization || 'No company specified'}</div>
                      <div className="pipeline-deal-meta"><strong>{fmtMoney(lead.dealValue, { notation: 'compact', maximumFractionDigits: 1 })}</strong><span>{lead.probability == null ? 20 : lead.probability}% probability</span></div>
                      <div className="pipeline-card-footer">
                        <span>{lead.assignedTo ? lead.assignedTo.name : 'Unassigned'}</span>
                        <span>{lead.expectedCloseDate ? 'Closes ' + fmtDate(lead.expectedCloseDate) : 'No close date'}</span>
                      </div>
                      <select value={lead.stage} onChange={(event) => move(lead._id, event.target.value)} aria-label={'Change stage for ' + lead.name}>
                        {STAGES.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="pipeline-table-card table-wrap">
          <table>
            <thead><tr><th>Opportunity</th><th>Company</th><th>Stage</th><th>Value</th><th>Probability</th><th>Expected close</th><th>Owner</th><th>Priority</th></tr></thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead._id}>
                  <td><Link to={'/leads/' + lead._id}>{lead.name}</Link><div className="muted small">{lead.email || '—'}</div></td>
                  <td>{lead.organization || '—'}</td>
                  <td><select value={lead.stage} onChange={(event) => move(lead._id, event.target.value)} aria-label={'Change stage for ' + lead.name}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></td>
                  <td>{fmtMoney(lead.dealValue)}</td>
                  <td>{lead.probability == null ? 20 : lead.probability}%</td>
                  <td>{fmtDate(lead.expectedCloseDate)}</td>
                  <td>{lead.assignedTo ? lead.assignedTo.name : 'Unassigned'}</td>
                  <td><span className={'badge prio-' + (lead.priority || 'Medium').toLowerCase()}>{lead.priority || 'Medium'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="muted small" aria-live="polite">{filteredLeads.length} of {leads.length} opportunities shown. Stage updates save to the CRM and revert when the server rejects a change.</div>
    </div>
  );
}
