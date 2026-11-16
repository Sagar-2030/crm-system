import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import api, { errMsg } from '../api.js';
import { Alert, Field } from '../components/ui.jsx';

const emptyWorkspace = { companyName: '', website: '', supportEmail: '', phone: '', address: '', currency: 'USD', timezone: '' };

export default function Settings() {
  const { user, updateUser, isManager } = useAuth();
  const [profileName, setProfileName] = useState(user?.name || '');
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => { setWorkspace({ ...emptyWorkspace, ...data.settings }); localStorage.setItem('crm_currency', data.settings.currency || 'USD'); localStorage.setItem('crm_timezone', data.settings.timezone || ''); }).catch((e) => setError(errMsg(e)));
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault(); setError(''); setMessage(''); setSaving(true);
    try { const { data } = await api.patch('/auth/profile', { name: profileName }); updateUser(data.user); setMessage('Profile saved.'); }
    catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  const changePassword = async (event) => {
    event.preventDefault(); setError(''); setMessage(''); setSaving(true);
    try { const { data } = await api.post('/auth/change-password', password); localStorage.setItem('crm_token', data.token); setPassword({ currentPassword: '', newPassword: '' }); setMessage('Password updated. Other sessions have been signed out.'); }
    catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  const saveWorkspace = async (event) => {
    event.preventDefault(); setError(''); setMessage(''); setSaving(true);
    try { const { data } = await api.patch('/settings', workspace); setWorkspace(data.settings); localStorage.setItem('crm_currency', data.settings.currency); localStorage.setItem('crm_timezone', data.settings.timezone || ''); window.dispatchEvent(new Event('crm-settings-updated')); setMessage('Company settings saved.'); }
    catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  return <div className="settings-page"><div className="page-head"><div><h2>Settings</h2><p className="muted small">Manage your profile, workspace, and secure access.</p></div></div><Alert>{error}</Alert><Alert kind="ok">{message}</Alert>
    <div className="grid-2 settings-grid">
      <section className="card"><h3>Your profile</h3><p className="muted small">Your name appears in activity and assignment lists.</p><form onSubmit={saveProfile} className="form-grid"><Field label="Display name"><input value={profileName} onChange={(e) => setProfileName(e.target.value)} required maxLength={100} /></Field><Field label="Email"><input value={user?.email || ''} readOnly /></Field><button className="btn primary" disabled={saving}>Save profile</button></form></section>
      <section className="card"><h3>Password & security</h3><p className="muted small">Choose a strong password with at least 8 characters.</p><form onSubmit={changePassword} className="form-grid"><Field label="Current password"><input type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} required autoComplete="current-password" /></Field><Field label="New password"><input type="password" minLength={8} value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} required autoComplete="new-password" /></Field><button className="btn primary" disabled={saving}>Update password</button></form></section>
      {isManager && <section className="card settings-workspace"><h3>Company workspace</h3><p className="muted small">Company identity and reporting preferences shared by this CRM workspace. Currency selection changes labels and formatting; it does not convert previously entered amounts.</p><form onSubmit={saveWorkspace} className="form-grid"><Field label="Company name"><input value={workspace.companyName} onChange={(e) => setWorkspace({ ...workspace, companyName: e.target.value })} required maxLength={120} /></Field><Field label="Website"><input type="url" value={workspace.website} onChange={(e) => setWorkspace({ ...workspace, website: e.target.value })} placeholder="https://example.com" /></Field><Field label="Support email"><input type="email" value={workspace.supportEmail} onChange={(e) => setWorkspace({ ...workspace, supportEmail: e.target.value })} /></Field><Field label="Phone"><input value={workspace.phone} onChange={(e) => setWorkspace({ ...workspace, phone: e.target.value })} /></Field><Field label="Address"><textarea rows="2" value={workspace.address} onChange={(e) => setWorkspace({ ...workspace, address: e.target.value })} /></Field><Field label="Reporting currency"><select value={workspace.currency} onChange={(e) => setWorkspace({ ...workspace, currency: e.target.value })}><option value="USD">US Dollar (USD)</option><option value="INR">Indian Rupee (INR)</option><option value="EUR">Euro (EUR)</option><option value="GBP">British Pound (GBP)</option></select></Field><Field label="Workspace timezone"><input value={workspace.timezone} onChange={(e) => setWorkspace({ ...workspace, timezone: e.target.value })} placeholder="Asia/Kolkata" /></Field><button className="btn primary" disabled={saving}>Save company settings</button></form></section>}
      <section className="card"><h3>Appearance</h3><p className="muted small">Choose a theme that works for your workspace.</p><p>Use the theme control at the bottom of the sidebar to switch between light and dark mode. Your preference is saved on this device.</p></section>
    </div>
  </div>;
}
