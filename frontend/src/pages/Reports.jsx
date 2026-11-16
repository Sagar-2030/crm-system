import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import api, { errMsg, fmtMoney } from '../api.js';
import { Alert, Empty } from '../components/ui.jsx';

export default function Reports() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [overview, setOverview] = useState(null);
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');

  const exportTeam = () => {
    const columns = ['name', 'role', 'department', 'jobTitle', 'leads', 'converted', 'revenue', 'monthlySalesTarget', 'targetAttainment', 'tasks', 'tasksCompleted', 'activities'];
    const cell = (value) => { const text = String(value ?? ''); const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };
    const csv = [columns.map(cell).join(','), ...team.map((member) => columns.map((key) => cell(member[key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `sales-performance-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const load = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(range).filter(([, v]) => v));
    try {
      const [o, t] = await Promise.all([api.get('/reports/overview', { params }), api.get('/reports/team', { params })]);
      setOverview(o.data);
      setTeam(t.data.team);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="page-head">
        <h2>Reports</h2>
        <div className="lead-actions"><button className="btn" type="button" onClick={() => window.print()}>Print / Save PDF</button><button className="btn" type="button" onClick={exportTeam}>Export team CSV</button></div>
      </div>
      <div className="card toolbar">
        <label className="field inline">
          <span>From</span>
          <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </label>
        <label className="field inline">
          <span>To</span>
          <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </label>
        <button className="btn" onClick={() => setRange({ from: '', to: '' })}>
          Clear
        </button>
      </div>
      <Alert>{error}</Alert>

      {overview && (
        <>
          <div className="grid-2">
            <div className="card">
              <h3>Lead sources and conversions</h3>
              {overview.bySource.length === 0 ? (
                <Empty>No leads in this range.</Empty>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={overview.bySource}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" name="Leads" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="converted" name="Converted" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="card">
              <h3>Source detail</h3>
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Leads</th>
                    <th>Converted</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.bySource.map((r) => (
                    <tr key={r.source}>
                      <td>{r.source}</td>
                      <td>{r.total}</td>
                      <td>{r.converted}</td>
                      <td>{r.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Booked revenue by employee</h3>
            {team.length === 0 ? <Empty>No team sales data.</Empty> : <div style={{ height: 280 }}><ResponsiveContainer><BarChart data={team}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip formatter={(value) => fmtMoney(value)} /><Legend /><Bar dataKey="revenue" name="Won revenue" fill="#16a37a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
          </div>

          <div className="card">
            <h3>Leads created per month</h3>
            {overview.monthly.length === 0 ? (
              <Empty>No data.</Empty>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={overview.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="created" name="Created" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="converted" name="Converted" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="grid-2">
            <div className="card"><h3>Customer growth</h3>{overview.customersMonthly?.length ? <div style={{ height: 260 }}><ResponsiveContainer><LineChart data={overview.customersMonthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="customers" name="New customers" stroke="#4f46e5" strokeWidth={2.5} /></LineChart></ResponsiveContainer></div> : <Empty>No customer growth data in this range.</Empty>}</div>
            <div className="card"><h3>Monthly booked revenue</h3>{overview.revenueMonthly?.length ? <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={overview.revenueMonthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => fmtMoney(value)} /><Bar dataKey="revenue" name="Booked revenue" fill="#16a37a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty>Revenue trends begin when a lead is converted.</Empty>}</div>
          </div>
          <div className="card"><h3>Pipeline value by stage</h3>{overview.dealByStage?.length ? <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={overview.dealByStage}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="stage" /><YAxis /><Tooltip formatter={(value) => fmtMoney(value)} /><Bar dataKey="value" name="Pipeline value" fill="#5b55df" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty>No pipeline data.</Empty>}</div>
        </>
      )}

      <div className="card table-wrap">
        <h3>Team activity</h3>
        {team.length === 0 ? (
          <Empty>No team members.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Leads</th>
                <th>Converted</th>
                <th>Revenue booked</th>
                <th>Target attainment</th>
                <th>Tasks</th>
                <th>Tasks completed</th>
                <th>Activities logged</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.userId}>
                  <td>{m.name}</td>
                  <td>{m.leads}</td>
                  <td>{m.converted}</td>
                  <td>{fmtMoney(m.revenue)}</td>
                  <td>{m.targetAttainment == null ? 'No target' : `${m.targetAttainment}%`}</td>
                  <td>{m.tasks}</td>
                  <td>{m.tasksCompleted}</td>
                  <td>{m.activities}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
