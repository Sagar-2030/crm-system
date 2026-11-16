import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { errMsg } from '../api.js';
import { Alert } from '../components/ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <aside className="login-showcase">
        <div className="login-brand">
          <span className="login-brand-mark"><BriefcaseBusiness size={20} strokeWidth={2.2} /></span>
          <span>Northstar <b>CRM</b></span>
        </div>

        <div className="showcase-content">
          <span className="showcase-eyebrow"><Sparkles size={14} /> YOUR BUSINESS, IN SYNC</span>
          <h1>Make every relationship <span>count.</span></h1>
          <p className="showcase-description">
            Bring your leads, customers, and team together in one clear view. Build stronger connections and keep every opportunity moving.
          </p>

          <div className="showcase-preview" aria-label="CRM workspace preview">
            <div className="preview-heading">
              <span className="preview-window-dots"><i /><i /><i /></span>
              <span>Opportunity overview</span>
              <span className="preview-live"><i /> Live</span>
            </div>
            <div className="preview-metrics">
              <div><span>Open opportunities</span><strong>24</strong><small>Across your pipeline</small></div>
              <div className="preview-chart" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            </div>
            <div className="preview-progress">
              <span><i className="progress-dot indigo" /> New <b>08</b></span>
              <span><i className="progress-dot cyan" /> Qualified <b>10</b></span>
              <span><i className="progress-dot green" /> Won <b>06</b></span>
            </div>
          </div>
        </div>

        <div className="showcase-footer">
          <div className="team-avatars" aria-hidden="true"><span>AS</span><span>MK</span><span>JD</span><UsersRound size={15} /></div>
          <span>One team. Every opportunity.</span>
        </div>
      </aside>

      <main className="login-main">
        <div className="login-top-note"><ShieldCheck size={16} /> Secure team workspace</div>
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-mobile-brand">
            <span className="login-brand-mark"><BriefcaseBusiness size={19} strokeWidth={2.2} /></span>
            <span>Northstar <b>CRM</b></span>
          </div>
          <div className="login-heading">
            <span className="login-heading-icon"><LockKeyhole size={19} /></span>
            <p className="login-kicker">WELCOME BACK</p>
            <h2 id="login-title">Sign in to your account</h2>
            <p>Enter your details to access your workspace.</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <Alert>{error}</Alert>
            <label className="login-field">
              <span>Username or email</span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="Enter your username or email"
                required
              />
            </label>
            <label className="login-field">
              <span>Password</span>
              <div className="login-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button className="login-submit" disabled={busy}>
              <span>{busy ? 'Signing you in…' : 'Sign in'}</span>
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="login-security-note"><ShieldCheck size={14} /> Your account is protected with secure sign-in.</p>
        </section>
        <footer className="login-footer">© 2026 Northstar CRM <span>·</span> Built for better relationships</footer>
      </main>
    </div>
  );
}
