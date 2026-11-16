import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg, fmtMoney, STAGES } from '../api.js';
import { Alert } from '../components/ui.jsx';

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/leads/board');
      setLeads(data.leads);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const move = async (id, stage) => {
    const lead = leads.find((l) => l._id === id);
    if (!lead || lead.stage === stage) return;
    const previous = leads;
    // Optimistic update, rolled back if the API rejects the change
    setLeads(leads.map((l) => (l._id === id ? { ...l, stage } : l)));
    try {
      await api.patch(`/leads/${id}/stage`, { stage });
      setError('');
    } catch (e) {
      setLeads(previous);
      setError(errMsg(e));
    }
  };

  return (
    <div>
      <div className="page-head">
        <h2>Pipeline</h2>
        <span className="muted">Drag a card to another column, or use the dropdown on the card.</span>
      </div>
      <Alert>{error}</Alert>
      <div className="board">
        {STAGES.map((stage) => {
          const items = leads.filter((l) => l.stage === stage);
          return (
            <div
              key={stage}
              className={`column${overStage === stage ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage(null)}
              onDrop={() => {
                setOverStage(null);
                if (dragId) move(dragId, stage);
                setDragId(null);
              }}
            >
              <div className="column-head">
                <span className={`badge stage-${stage}`}>{stage}</span>
                <span className="muted">{items.length}</span>
              </div>
              {items.map((l) => (
                <div key={l._id} className="pcard" draggable onDragStart={() => setDragId(l._id)} onDragEnd={() => setDragId(null)}>
                  <Link to={`/leads/${l._id}`}>
                    <strong>{l.name}</strong>
                  </Link>
                  <div className="muted small">{l.organization || '—'}</div>
                  <div className="muted small">{l.assignedTo ? l.assignedTo.name : 'Unassigned'}</div>
                  <div className="pipeline-deal-meta"><strong>{fmtMoney(l.dealValue, { notation: 'compact', maximumFractionDigits: 1 })}</strong><span>{l.probability ?? 20}% · {l.priority || 'Medium'} priority</span></div>
                  {l.expectedCloseDate && <div className="muted small">Close {new Date(l.expectedCloseDate).toLocaleDateString()}</div>}
                  <select value={l.stage} onChange={(e) => move(l._id, e.target.value)} aria-label={`Stage for ${l.name}`}>
                    {STAGES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
