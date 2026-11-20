import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity, ArrowDownToLine, BadgeCheck, ChartNoAxesCombined, CircleAlert,
  Code2, KeyRound, LayoutDashboard, LockKeyhole, LogOut, Search, Settings2,
  ShieldCheck, Users, Eye, EyeOff, LoaderCircle, Plus, Copy, RefreshCw,
  Ban, Pencil, CheckCircle2, Sun, Moon,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { adminRequest } from './lib/adminApi';

type AccessState = 'checking' | 'allowed' | 'denied' | 'error';
type Page = 'Overview' | 'Activation codes' | 'Subscriptions' | 'Users' | 'Activity log' | 'Settings';
type CodeRow = {
  id: string; assigned_name: string | null; notes: string | null; duration_months: number; duration_days?: number | null; is_lifetime?: boolean;
  tier: 'standard' | 'premium'; is_active: boolean; redeemed_by: string | null;
  redeemed_at: string | null; redeemed_by_name?: string | null; created_at: string;
};
type SubscriptionRow = {
  id: string; user_id: string; display_name: string | null; status: string;
  tier: string; starts_at: string; expires_at: string; is_lifetime?: boolean; created_at: string;
};
type UserRow = {
  id: string; email?: string; createdAt: string;
  profile: { display_name: string | null } | null;
  subscription: { status: string; tier: string; expires_at: string; is_lifetime?: boolean } | null;
};
type AuditRow = {
  id: number; actor_user_id: string | null; target_user_id: string | null;
  action: string; metadata: Record<string, unknown>; created_at: string;
};

const nav: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Activation codes', icon: KeyRound },
  { label: 'Subscriptions', icon: BadgeCheck },
  { label: 'Users', icon: Users },
  { label: 'Activity log', icon: Activity },
  { label: 'Settings', icon: Settings2 },
];
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

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
      email: email.trim(), password,
    });
    setBusy(false);
    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Email or password is incorrect.' : authError.message);
      return;
    }
    if (data.session) onSignedIn(data.session);
  }

  return <main className="auth-shell">
    <div className="binary-field" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => <span key={i}>{i % 2 ? '0100101' : '1011010'}</span>)}
    </div>
    <section className="auth-card">
      <div className="auth-brand"><div className="brand-mark"><img src="/omax-mark.svg" alt="Omax logo" /></div><div><strong>Omax</strong><span>CONTROL CENTER</span></div></div>
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
  return <main className="auth-shell"><section className="auth-card access-card">
    <div className="auth-icon"><ShieldCheck size={23}/></div>
    <div className="eyebrow">ACCESS VERIFICATION</div>
    <h1>{denied ? 'Administrator access required' : 'Could not verify access'}</h1>
    <p className="auth-copy">{denied
      ? 'This account is signed in, but it is not listed as an Omax administrator.'
      : 'The admin verification request failed. Check the connection and try again.'}</p>
    {state === 'error' && <button className="primary auth-submit" onClick={onRetry}>Try again</button>}
    <button className="secondary-action" onClick={onSignOut}><LogOut size={16}/> Sign out</button>
  </section></main>;
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [page, setPage] = useState<Page>('Overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [metrics, setMetrics] = useState({ totalCodes: 0, activeSubscriptions: 0, registeredUsers: 0, redemptions: 0 });
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [count, setCount] = useState('1');
  const [durationDays, setDurationDays] = useState('30');
  const [lifetime, setLifetime] = useState(false);
  const [tier, setTier] = useState<'standard' | 'premium'>('standard');
  const [assignedName, setAssignedName] = useState('');
  const [notes, setNotes] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [dark, setDark] = useState(true);

  async function loadPage(target = page) {
    setBusy(true); setError('');
    try {
      if (target === 'Overview') {
        const data = await adminRequest<typeof metrics>('dashboard');
        setMetrics(data);
      } else if (target === 'Activation codes') {
        const data = await adminRequest<{ codes: CodeRow[] }>('list_codes');
        setCodes(data.codes ?? []);
      } else if (target === 'Subscriptions') {
        const data = await adminRequest<{ subscriptions: SubscriptionRow[] }>('list_subscriptions');
        setSubscriptions(data.subscriptions ?? []);
      } else if (target === 'Users') {
        const data = await adminRequest<{ users: UserRow[] }>('list_users');
        setUsers(data.users ?? []);
      } else if (target === 'Activity log') {
        const data = await adminRequest<{ logs: AuditRow[] }>('list_audit');
        setLogs(data.logs ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load data.');
    } finally { setBusy(false); }
  }

  useEffect(() => { void loadPage(page); }, [page]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setGeneratedCodes([]);
    try {
      const data = await adminRequest<{ codes: string[] }>('generate_codes', {
        count: customCode.trim() ? 1 : Number(count), durationDays: Number(durationDays), isLifetime: lifetime, tier, assignedName, notes,
        ...(customCode.trim() ? { customCodes: [customCode.trim()] } : {}),
      });
      setGeneratedCodes(data.codes ?? []); setCustomCode('');
      setNotice('Codes created. Copy or save them now — the original code text is shown only once.');
      await loadPage('Activation codes');
    } catch (e) { setError(e instanceof Error ? e.message : 'Code generation failed.'); }
    finally { setBusy(false); }
  }

  async function updateCode(code: CodeRow) {
    const name = window.prompt('Assigned name (leave blank to clear):', code.assigned_name ?? '');
    if (name === null) return;
    const note = window.prompt('Internal notes (leave blank to clear):', code.notes ?? '');
    if (note === null) return;
    const durationInput = window.prompt('Duration in days (1–365), or type lifetime:', code.is_lifetime ? 'lifetime' : String(code.duration_days ?? code.duration_months * 30));
    if (durationInput === null) return;
    const nextLifetime = durationInput.trim().toLowerCase() === 'lifetime';
    const nextDays = Number(durationInput.trim());
    if (!nextLifetime && (!Number.isInteger(nextDays) || nextDays < 1 || nextDays > 365)) {
      setError('Duration must be 1–365 days, or lifetime.'); return;
    }
    const nextTier = window.prompt('Tier (standard or premium):', code.tier);
    if (nextTier === null || !['standard', 'premium'].includes(nextTier.trim().toLowerCase())) return;
    setBusy(true); setError('');
    try {
      await adminRequest('update_code', { id: code.id, assignedName: name, notes: note, durationDays: nextDays, isLifetime: nextLifetime, tier: nextTier.trim().toLowerCase() });
      setNotice('Code details updated.'); await loadPage('Activation codes');
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed.'); }
    finally { setBusy(false); }
  }

  async function toggleCode(code: CodeRow) {
    setBusy(true); setError('');
    try {
      await adminRequest('update_code', { id: code.id, isActive: !code.is_active });
      setNotice(code.is_active ? 'Code deactivated.' : 'Code activated.');
      await loadPage('Activation codes');
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed.'); }
    finally { setBusy(false); }
  }

  async function revokeSubscription(row: SubscriptionRow) {
    if (!window.confirm('Revoke this active subscription? This action is recorded in the audit log.')) return;
    setBusy(true); setError('');
    try {
      await adminRequest('revoke_subscription', { id: row.id });
      setNotice('Subscription revoked.'); await loadPage('Subscriptions');
    } catch (e) { setError(e instanceof Error ? e.message : 'Revoke failed.'); }
    finally { setBusy(false); }
  }

  async function copyCodes() {
    try { await navigator.clipboard.writeText(generatedCodes.join('\n')); setNotice('Generated codes copied to clipboard.'); }
    catch { setError('Clipboard access was blocked. Select and copy the codes manually.'); }
  }

  const filteredCodes = codes.filter(c => [c.assigned_name, c.id, c.tier].some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())));
  const filteredUsers = users.filter(u => [u.email, u.profile?.display_name, u.id].some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())));

  return <div className={dark ? 'shell' : 'shell light-shell'}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><img src="/omax-mark.svg" alt="Omax logo" /></div><div><strong>Omax</strong><span>CONTROL CENTER</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(({ label, icon: Icon }) => <button className={`nav-item ${page === label ? 'active' : ''}`} key={label} onClick={() => { setPage(label); setSearch(''); setNotice(''); }}>
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
      <header className="topbar"><div className="crumb">Omax <span>/</span> {page}</div>
        <div className="top-actions"><span className="status verified"><i/> Admin verified</span>
          <button className="icon-btn" onClick={() => setDark(v => !v)} aria-label="Toggle theme">{dark ? <Sun size={17}/> : <Moon size={17}/>}</button>
          <button className="icon-btn" onClick={() => void loadPage()} aria-label="Refresh"><RefreshCw size={17}/></button>
        </div>
      </header>
      <section className="content page-transition" key={page}>
        <div className="heading-row"><div><div className="eyebrow">ADMINISTRATION</div><h1>{page}</h1>
          <p className="subtitle">{page === 'Overview' ? 'Your secure workspace for activation and subscription management.' : `Manage Omax ${page.toLowerCase()} from this workspace.`}</p></div>
          {page === 'Activation codes' && <button className="primary" onClick={() => document.getElementById('code-generator')?.scrollIntoView({ behavior: 'smooth' })}><Plus size={17}/> Generate codes</button>}
        </div>
        {error && <div className="notice error-notice"><CircleAlert size={18}/><div><strong>Operation needs attention</strong><p>{error}</p></div></div>}
        {notice && <div className="notice success-notice"><CheckCircle2 size={18}/><div><strong>{notice}</strong></div></div>}
        {busy && <div className="loading-inline"><LoaderCircle className="spin" size={16}/> Loading / processing…</div>}

        {page === 'Overview' && <>
          <div className="stats">
            <article className="stat"><div className="stat-icon violet"><KeyRound size={19}/></div><span>Total codes</span><strong>{metrics.totalCodes}</strong><small>All generated codes</small></article>
            <article className="stat"><div className="stat-icon blue"><BadgeCheck size={19}/></div><span>Active subscriptions</span><strong>{metrics.activeSubscriptions}</strong><small>Currently valid</small></article>
            <article className="stat"><div className="stat-icon green"><Users size={19}/></div><span>Registered users</span><strong>{metrics.registeredUsers}</strong><small>Profiles created</small></article>
            <article className="stat"><div className="stat-icon amber"><ChartNoAxesCombined size={19}/></div><span>Redemptions</span><strong>{metrics.redemptions}</strong><small>Codes already used</small></article>
          </div>
          <div className="lower-grid">
            <section className="panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Common administration tasks</p></div><Code2 size={19}/></div>
              <div className="quick-list">
                <button onClick={() => setPage('Activation codes')}><KeyRound/><span><strong>Create activation codes</strong><small>Generate single codes or batches with custom rules</small></span><Plus/></button>
                <button onClick={() => setPage('Users')}><Users/><span><strong>Manage users</strong><small>Review accounts and subscription status</small></span><ArrowDownToLine/></button>
                <button onClick={() => setPage('Activity log')}><Activity/><span><strong>Review activity</strong><small>Inspect administrative and redemption events</small></span><ArrowDownToLine/></button>
              </div>
            </section>
            <section className="panel"><div className="panel-head"><div><h2>System status</h2><p>Connection and service health</p></div><Activity size={19}/></div>
              <div className="health-row"><span><i className="online"/> Supabase project</span><b className="good">Connected</b></div>
              <div className="health-row"><span><i className="online"/> Admin authentication</span><b className="good">Verified</b></div>
              <div className="health-row"><span><i className="online"/> Admin API</span><b className="good">Responding</b></div>
              <div className="health-foot">Privileged database operations run through server-side functions with a verified administrator session.</div>
            </section>
          </div>
        </>}

        {page === 'Activation codes' && <>
          <section className="panel generator" id="code-generator">
            <div className="panel-head"><div><h2>Generate activation codes</h2><p>Cryptographically random codes; only hashes are stored in the database.</p></div><KeyRound size={19}/></div>
            <form className="generator-grid" onSubmit={generate}>
              <label>Quantity<input type="number" min="1" max="100" value={count} onChange={e => setCount(e.target.value)} required /></label>
              <label>Duration (days)<input type="number" min="1" max="365" value={durationDays} onChange={e => setDurationDays(e.target.value)} disabled={lifetime} required={!lifetime} /></label>
              <label className="lifetime-field"><span>Lifetime access</span><span className="lifetime-control"><input type="checkbox" checked={lifetime} onChange={e => setLifetime(e.target.checked)} /> No expiration</span></label>
              <label>Subscription tier<select value={tier} onChange={e => setTier(e.target.value as 'standard' | 'premium')}><option value="standard">Standard</option><option value="premium">Premium</option></select></label>
              <label>Assigned to<input value={assignedName} onChange={e => setAssignedName(e.target.value)} maxLength={120} placeholder="Optional person / customer name" /></label>
              <label>Custom code (optional)<input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} maxLength={48} placeholder="Leave empty for random" /></label>
              <label className="wide-field">Internal notes<input value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} placeholder="Optional notes" /></label>
              <button className="primary" type="submit" disabled={busy}><Plus size={16}/> Generate securely</button>
            </form>
            {generatedCodes.length > 0 && <div className="generated-box"><div><strong>New codes — shown once</strong><button className="secondary-action compact" onClick={() => void copyCodes()}><Copy size={14}/> Copy all</button></div><pre>{generatedCodes.join('\n')}</pre><small>Save these codes now. The original text cannot be recovered later.</small></div>}
          </section>
          <div className="table-toolbar"><div><h2>Code inventory</h2><p>Up to 250 latest codes</p></div><div className="search-box"><Search size={15}/><input placeholder="Search name, ID, tier…" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
          <div className="table-wrap"><table><thead><tr><th>Assigned to</th><th>Tier</th><th>Duration</th><th>Status</th><th>Created</th><th>Redeemed by</th><th>Redeemed at</th><th>Actions</th></tr></thead>
            <tbody>{filteredCodes.map(code => <tr key={code.id}><td><strong>{code.assigned_name || 'Unassigned'}</strong><small>{code.id.slice(0, 8)}…</small></td><td><span className={`pill ${code.tier}`}>{code.tier}</span></td><td>{code.is_lifetime ? 'Lifetime' : code.duration_days ? `${code.duration_days} days` : `${code.duration_months} mo.`}</td><td><span className={`pill ${code.redeemed_by ? 'used' : code.is_active ? 'active' : 'disabled'}`}>{code.redeemed_by ? 'Used' : code.is_active ? 'Available' : 'Disabled'}</span></td><td>{date(code.created_at)}</td><td>{code.redeemed_by ? (code.redeemed_by_name || code.redeemed_by.slice(0, 12) + '…') : '—'}</td><td>{date(code.redeemed_at)}</td><td><button className="table-action" onClick={() => void updateCode(code)} title="Edit metadata" disabled={!!code.redeemed_by}><Pencil size={14}/></button><button className="table-action" onClick={() => void toggleCode(code)} title={code.is_active ? 'Deactivate' : 'Activate'} disabled={!!code.redeemed_by}><Ban size={14}/></button></td></tr>)}
            {filteredCodes.length === 0 && <tr><td colSpan={8} className="empty-cell">No activation codes found.</td></tr>}</tbody></table></div>
        </>}

        {page === 'Subscriptions' && <div className="table-wrap"><table><thead><tr><th>User</th><th>Tier</th><th>Status</th><th>Start</th><th>Expires</th><th>Actions</th></tr></thead><tbody>
          {subscriptions.map(row => <tr key={row.id}><td><strong>{row.display_name || 'User'}</strong><small>{row.user_id.slice(0, 12)}…</small></td><td><span className={`pill ${row.tier}`}>{row.tier}</span></td><td><span className={`pill ${row.status}`}>{row.status}</span></td><td>{date(row.starts_at)}</td><td>{row.is_lifetime ? 'Lifetime' : date(row.expires_at)}</td><td><button className="table-action danger" title="Revoke subscription" disabled={row.status !== 'active'} onClick={() => void revokeSubscription(row)}><Ban size={14}/></button></td></tr>)}
          {subscriptions.length === 0 && <tr><td colSpan={6} className="empty-cell">No subscriptions found.</td></tr>}</tbody></table></div>}

        {page === 'Users' && <><div className="table-toolbar"><div><h2>Registered users</h2><p>Latest 100 accounts</p></div><div className="search-box"><Search size={15}/><input placeholder="Search email, name, ID…" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
          <div className="table-wrap"><table><thead><tr><th>User</th><th>Created</th><th>Subscription</th><th>Tier</th><th>Expires</th></tr></thead><tbody>
            {filteredUsers.map(user => <tr key={user.id}><td><strong>{user.profile?.display_name || user.email || 'User'}</strong><small>{user.email || user.id}</small></td><td>{date(user.createdAt)}</td><td>{user.subscription?.status || 'None'}</td><td>{user.subscription?.tier || '—'}</td><td>{user.subscription?.is_lifetime ? 'Lifetime' : date(user.subscription?.expires_at)}</td></tr>)}
            {filteredUsers.length === 0 && <tr><td colSpan={5} className="empty-cell">No users found.</td></tr>}</tbody></table></div></>}

        {page === 'Activity log' && <div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Details</th><th>Date</th></tr></thead><tbody>
          {logs.map(log => <tr key={log.id}><td><strong>{log.action}</strong></td><td>{log.actor_user_id?.slice(0, 12) || 'System'}…</td><td>{log.target_user_id?.slice(0, 12) || '—'}</td><td><code>{JSON.stringify(log.metadata)}</code></td><td>{date(log.created_at)}</td></tr>)}
          {logs.length === 0 && <tr><td colSpan={5} className="empty-cell">No activity records found.</td></tr>}</tbody></table></div>}

        {page === 'Settings' && <section className="panel settings-panel"><div className="panel-head"><div><h2>Workspace settings</h2><p>Current administrator session and appearance</p></div><Settings2 size={19}/></div>
          <div className="health-row"><span>Signed in as</span><b className="good">{session.user.email}</b></div>
          <div className="health-row"><span>Supabase project</span><b className="good">biwcwwxsauineaowreot</b></div>
          <div className="health-row"><span>Appearance</span><button className="secondary-action compact" onClick={() => setDark(v => !v)}>{dark ? <Sun size={14}/> : <Moon size={14}/>} {dark ? 'Switch to light' : 'Switch to dark'}</button></div>
          <button className="secondary-action" onClick={onSignOut}><LogOut size={16}/> Sign out securely</button>
        </section>}
        <footer><span>Omax Control Center</span><span>Secure admin workspace · v0.3.0</span></footer>
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
    setSession(currentSession);
    setAccess('checking'); setChecking(true);
    const { data, error } = await supabase.rpc('omax_is_admin');
    setChecking(false);
    if (error) { console.error('Admin verification failed:', error.message); setAccess('error'); return; }
    setAccess(data === true ? 'allowed' : 'denied');
    setSession(currentSession);
  }

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) { setChecking(false); setAccess('error'); return; }
      if (data.session) void verifyAdmin(data.session);
      else { setSession(null); setChecking(false); setAccess('checking'); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active || event === 'INITIAL_SESSION' || event === 'SIGNED_IN') return;
      if (nextSession) { setSession(nextSession); void verifyAdmin(nextSession); }
      else { setSession(null); setAccess('checking'); setChecking(false); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut(); setSession(null); setAccess('checking');
  }

  if (!isSupabaseConfigured || !supabase) return <main className="auth-shell"><section className="auth-card">
    <div className="auth-icon"><Code2 size={23}/></div><div className="eyebrow">SETUP REQUIRED</div>
    <h1>Connect Supabase</h1><p className="auth-copy">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the deployment environment, then rebuild.</p>
  </section></main>;
  if (checking || (session && access === 'checking')) return <main className="auth-shell"><div className="loading-state"><LoaderCircle className="spin" size={25}/><span>Verifying secure admin access…</span></div></main>;
  if (!session) return <LoginScreen onSignedIn={next => { setSession(next); void verifyAdmin(next); }}/>;
  if (access === 'denied' || access === 'error') return <AccessMessage state={access} onRetry={() => void verifyAdmin(session)} onSignOut={() => void signOut()}/>;
  return <Dashboard session={session} onSignOut={() => void signOut()}/>;
}

export default App;
