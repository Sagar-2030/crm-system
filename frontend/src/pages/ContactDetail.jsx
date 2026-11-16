import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarDays, Mail, MessageSquareText, Phone, UserRound } from 'lucide-react';
import api, { errMsg, fmtDate, fmtDateTime, fmtMoney } from '../api.js';
import { Alert, Empty } from '../components/ui.jsx';

const activityIcons = { note: MessageSquareText, call: Phone, email: Mail, meeting: CalendarDays };

export default function ContactDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [entry, setEntry] = useState({ type: 'note', notes: '' });
  const [purchase, setPurchase] = useState({ description: '', amount: '', status: 'Paid', purchasedAt: new Date().toISOString().slice(0, 10) });
  const load = useCallback(async () => {
    try { const response = await api.get(`/contacts/${id}`); setData(response.data); setError(''); }
    catch (e) { setError(errMsg(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    try { await api.post(`/contacts/${id}/activities`, entry); setEntry({ type: 'note', notes: '' }); await load(); }
    catch (e) { setError(errMsg(e)); }
  };

  const submitPurchase = async (event) => {
    event.preventDefault();
    try { await api.post(`/contacts/${id}/purchases`, purchase); setPurchase({ description: '', amount: '', status: 'Paid', purchasedAt: new Date().toISOString().slice(0, 10) }); await load(); }
    catch (e) { setError(errMsg(e)); }
  };

  if (!data && error) return <div><Link to="/contacts" className="link"><ArrowLeft size={14} /> Back to customers</Link><Alert>{error}</Alert></div>;
  if (!data) return <p className="muted">Loading customer profile…</p>;
  const { contact, activities, purchases = [] } = data;
  return <div className="customer-profile">
    <Link to="/contacts" className="link"><ArrowLeft size={14} /> Back to customers</Link>
    <header className="page-head"><div><div className="profile-overline">CUSTOMER PROFILE</div><h2>{contact.name}</h2><p className="muted">{contact.organization || 'Individual customer'}{contact.industry ? ` · ${contact.industry}` : ''}</p></div><div><span className="badge">{contact.category || 'Customer'}</span> <span className={`badge ${contact.status === 'Active' || !contact.status ? 'on' : contact.status === 'At Risk' ? 'prio-High' : 'off'}`}>{contact.status || 'Active'}</span></div></header>
    {error && <Alert>{error}</Alert>}
    <div className="grid-2">
      <section className="card"><h3>Customer details</h3><dl className="details customer-details"><dt><Mail size={14} /> Email</dt><dd>{contact.email || '—'}</dd><dt><Phone size={14} /> Phone</dt><dd>{contact.phone || '—'}</dd><dt><Building2 size={14} /> Company</dt><dd>{contact.organization || '—'}</dd><dt><UserRound size={14} /> Owner</dt><dd>{contact.assignedTo?.name || 'Unassigned'}</dd><dt>Lifetime value</dt><dd>{fmtMoney(contact.lifetimeValue)}</dd><dt>Monthly recurring revenue</dt><dd>{fmtMoney(contact.monthlyRecurringRevenue)}</dd><dt>Customer since</dt><dd>{fmtDate(contact.createdAt)}</dd><dt>Tags</dt><dd>{contact.tags?.length ? contact.tags.join(' · ') : 'No tags'}</dd><dt>Linked lead</dt><dd>{contact.lead ? <Link to={`/leads/${contact.lead._id}`}>{contact.lead.name} · {contact.lead.stage}</Link> : 'No linked lead'}</dd></dl><h4>Internal notes</h4><p className="profile-notes">{contact.notes || 'No internal notes yet.'}</p></section>
      <section className="card"><h3>Communication history</h3><form className="inline-form profile-activity-form" onSubmit={submit}><select value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value })}><option value="note">Internal note</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option></select><input placeholder="Log a customer interaction" value={entry.notes} onChange={(e) => setEntry({ ...entry, notes: e.target.value })} required /><button className="btn primary">Add</button></form>{activities.length === 0 ? <Empty>No customer interactions logged.</Empty> : <ul className="timeline">{activities.map((activity) => { const Icon = activityIcons[activity.type] || MessageSquareText; return <li key={activity._id}><span className="activity-icon"><Icon size={14} /></span><div><strong className="tl-type">{activity.type}</strong><p>{activity.notes}</p><small className="muted">{activity.user?.name || 'Team member'} · {fmtDateTime(activity.createdAt)}</small></div></li>; })}</ul>}</section>
    </div>
    <section className="card purchase-history"><div className="dashboard-panel-heading"><div><h3>Purchase history</h3><p className="muted small">Manually recorded transactions for this customer.</p></div></div><form className="inline-form" onSubmit={submitPurchase}><input placeholder="Product or service" value={purchase.description} onChange={(e) => setPurchase({ ...purchase, description: e.target.value })} required /><input type="number" min="0" step="0.01" placeholder={`Amount (${localStorage.getItem('crm_currency') || 'USD'})`} value={purchase.amount} onChange={(e) => setPurchase({ ...purchase, amount: e.target.value })} required /><input type="date" value={purchase.purchasedAt} onChange={(e) => setPurchase({ ...purchase, purchasedAt: e.target.value })} required /><select value={purchase.status} onChange={(e) => setPurchase({ ...purchase, status: e.target.value })}><option>Paid</option><option>Pending</option><option>Refunded</option></select><button className="btn primary">Add purchase</button></form>{purchases.length === 0 ? <Empty>No purchases recorded.</Empty> : <div className="table-wrap"><table><thead><tr><th>Product or service</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead><tbody>{purchases.map((item) => <tr key={item._id}><td>{item.description}</td><td>{fmtDate(item.purchasedAt)}</td><td><span className={`badge ${item.status === 'Paid' ? 'on' : item.status === 'Refunded' ? 'off' : 'prio-Medium'}`}>{item.status}</span></td><td>{fmtMoney(item.amount)}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
