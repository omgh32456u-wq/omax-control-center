import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity, ArrowDownToLine, BadgeCheck, ChartNoAxesCombined, CircleAlert,
  Code2, KeyRound, LayoutDashboard, LockKeyhole, LogOut, Search, Settings2,
  ShieldCheck, Users, Eye, EyeOff, LoaderCircle,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';

type AccessState = 'checking' | 'allowed' | 'denied' | 'error';

const nav = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Activation codes', icon: KeyRound },
  { label: 'Subscriptions', icon: BadgeCheck },
  { label: 'Users', icon: Users },
  { label: 'Activity log', icon: Activity },
  { label: 'Settings', icon: Settings2 },
];

function LoginScreen({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Email or password is incorrect.'
        : authError.message);
      return;
    }
    if (data.session) onSignedIn(data.session);
  }

  return <main className="auth-shell">
    <div className="binary-field" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => <span key={i}>{i % 2 ? '0100101' : '1011010'}</span>)}
    </div>
    <section className="auth-card">
      <div className="auth-brand"><div className="brand-mark">O</div><div><strong>Omax</strong><span>CONTROL CENTER</span></div></div>
      <div className="auth-icon"><ShieldCheck size={23}/></div>
      <div className="eyebrow">RESTRICTED WORKSPACE</div>
      <h1>Admin sign in</h1>
      <p className="auth-copy">Sign in with your authorized administrator account to continue.</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="admin-email">Email address</label>
        <input id="admin-email" type="email" autoComplete="username" value={email}
          onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required />
        <label htmlFor="admin-password">Password</label>
        <div className="password-wrap">
          <input id="admin-password" type={showPassword ? 'text' : 'password'}
            autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}
          </button>
        </div>
        {error && <div className="form-error"><CircleAlert size={16}/>{error}</div>}
        <button className="primary auth-submit" type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17}/> : <LockKeyhole size={17}/>}
          {busy ? 'Signing in…' : 'Sign in securely'}
        </button>
      </form>
      <div className="auth-foot"><LockKeyhole size={13}/> Protected by Supabase Authentication</div>
    </section>
    <div className="auth-version">OMAX SYSTEMS <span>•</span> SECURE ADMIN ACCESS</div>
  </main>;
}

function AccessMessage({ state, onRetry, onSignOut }: {
  state: AccessState; onRetry: () => void; onSignOut: () => void;
}) {
  const denied = state === 'denied';
  return <main className="auth-shell">
    <section className="auth-card access-card">
      <div className="auth-icon"><ShieldCheck size={23}/></div>
      <div className="eyebrow">ACCESS VERIFICATION</div>
      <h1>{denied ? 'Administrator access required' : 'Could not verify access'}</h1>
      <p className="auth-copy">{denied
        ? 'This account is signed in, but it is not listed as an Omax administrator.'
        : 'The admin verification request failed. Check the connection and try again.'}</p>
      {state === 'error' && <button className="primary auth-submit" onClick={onRetry}>Try again</button>}
      <button className="secondary-action" onClick={onSignOut}><LogOut size={16}/> Sign out</button>
    </section>
  </main>;
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">O</div><div><strong>Omax</strong><span>CONTROL CENTER</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(({ label, icon: Icon, active }) => <button className={`nav-item ${active ? 'active' : ''}`} key={label}>
        <Icon size={18}/><span>{label}</span>
      </button>)}</nav>
      <div className="sidebar-bottom">
        <div className="secure-note"><ShieldCheck size={17}/><span>Verified administrator</span></div>
        <div className="profile"><div className="avatar">{(session.user.email?.[0] ?? 'A').toUpperCase()}</div>
          <div><strong>{session.user.email ?? 'Administrator'}</strong><span>Admin access verified</span></div>
          <button className="logout-btn" onClick={onSignOut} aria-label="Sign out"><LogOut size={16}/></button>
        </div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Omax <span>/</span> Overview</div>
        <div className="top-actions"><span className="status verified"><i/> Admin verified</span>
          <button className="icon-btn" aria-label="Search"><Search size={18}/></button></div>
      </header>
      <section className="content">
        <div className="heading-row"><div><div className="eyebrow">ADMINISTRATION</div><h1>Overview</h1>
          <p className="subtitle">Your secure workspace for activation and subscription management.</p></div>
          <button className="primary" disabled><KeyRound size={17}/> Generate codes</button></div>
        <div className="notice"><CircleAlert size={19}/><div><strong>Secure connection established — management is being connected</strong>
          <p>Administrator authentication and server-side admin verification are active. Dashboard data and management actions will be enabled after their secure Edge Functions are implemented.</p></div></div>
        <div className="stats">
          <article className="stat"><div className="stat-icon violet"><KeyRound size={19}/></div><span>Total codes</span><strong>—</strong><small>Data endpoint not connected</small></article>
          <article className="stat"><div className="stat-icon blue"><BadgeCheck size={19}/></div><span>Active subscriptions</span><strong>—</strong><small>Data endpoint not connected</small></article>
          <article className="stat"><div className="stat-icon green"><Users size={19}/></div><span>Registered users</span><strong>—</strong><small>Data endpoint not connected</small></article>
          <article className="stat"><div className="stat-icon amber"><ChartNoAxesCombined size={19}/></div><span>Redemptions</span><strong>—</strong><small>Data endpoint not connected</small></article>
        </div>
        <div className="lower-grid">
          <section className="panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Common administration tasks</p></div><Code2 size={19}/></div>
            <div className="quick-list">
              <div><KeyRound/><span><strong>Create activation codes</strong><small>Generate single codes or batches with custom rules</small></span><LockKeyhole/></div>
              <div><Users/><span><strong>Manage users</strong><small>Review accounts and their subscription status</small></span><LockKeyhole/></div>
              <div><ArrowDownToLine/><span><strong>Export code batches</strong><small>Download generated codes securely</small></span><LockKeyhole/></div>
            </div>
          </section>
          <section className="panel"><div className="panel-head"><div><h2>System status</h2><p>Connection and service health</p></div><Activity size={19}/></div>
            <div className="health-row"><span><i className="online"/> Supabase project</span><b className="good">Connected</b></div>
            <div className="health-row"><span><i className="online"/> Admin authentication</span><b className="good">Verified</b></div>
            <div className="health-row"><span><i className="pending"/> Management functions</span><b>In progress</b></div>
            <div className="health-foot">Privileged database operations will run only through verified server-side functions.</div>
          </section>
        </div>
        <footer><span>Omax Control Center</span><span>Secure setup · v0.2.0</span></footer>
      </section>
    </main>
  </div>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AccessState>('checking');
  const [checking, setChecking] = useState(true);

  async function verifyAdmin(currentSession: Session) {
    if (!supabase) return;
    setAccess('checking');
    setChecking(true);
    const { data, error } = await supabase.rpc('omax_is_admin');
    setChecking(false);
    if (error) {
      console.error('Admin verification failed:', error.message);
      setAccess('error');
      return;
    }
    setAccess(data === true ? 'allowed' : 'denied');
    setSession(currentSession);
  }

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setChecking(false);
        setAccess('error');
        return;
      }
      if (data.session) void verifyAdmin(data.session);
      else {
        setSession(null);
        setChecking(false);
        setAccess('checking');
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      if (nextSession) {
        setSession(nextSession);
        void verifyAdmin(nextSession);
      } else {
        setSession(null);
        setAccess('checking');
        setChecking(false);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setAccess('checking');
  }

  if (!isSupabaseConfigured || !supabase) {
    return <main className="auth-shell"><section className="auth-card">
      <div className="auth-icon"><Code2 size={23}/></div><div className="eyebrow">SETUP REQUIRED</div>
      <h1>Connect Supabase</h1><p className="auth-copy">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your deployment environment, then redeploy this branch.</p>
    </section></main>;
  }
  if (checking || (session && access === 'checking')) {
    return <main className="auth-shell"><div className="loading-state"><LoaderCircle className="spin" size={25}/><span>Verifying secure admin access…</span></div></main>;
  }
  if (!session) return <LoginScreen onSignedIn={next => { setSession(next); void verifyAdmin(next); }}/>;
  if (access === 'denied' || access === 'error') {
    return <AccessMessage state={access} onRetry={() => void verifyAdmin(session)} onSignOut={() => void signOut()}/>;
  }
  return <Dashboard session={session} onSignOut={() => void signOut()}/>;
}

export default App;
