import { Activity, ArrowDownToLine, BadgeCheck, ChartNoAxesCombined, CircleAlert, Code2, KeyRound, LayoutDashboard, LockKeyhole, Search, Settings2, ShieldCheck, Users } from 'lucide-react';

const nav = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Activation codes', icon: KeyRound },
  { label: 'Subscriptions', icon: BadgeCheck },
  { label: 'Users', icon: Users },
  { label: 'Activity log', icon: Activity },
  { label: 'Settings', icon: Settings2 },
];

function App() {
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">O</div><div><strong>Omax</strong><span>CONTROL CENTER</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(({label,icon:Icon,active}) => <button className={`nav-item ${active?'active':''}`} key={label}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="secure-note"><ShieldCheck size={17}/><span>Protected admin area</span></div><div className="profile"><div className="avatar">A</div><div><strong>Administrator</strong><span>Admin access required</span></div></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Omax <span>/</span> Overview</div><div className="top-actions"><span className="status"><i/> Setup stage</span><button className="icon-btn" aria-label="Search"><Search size={18}/></button></div></header>
      <section className="content">
        <div className="heading-row"><div><div className="eyebrow">ADMINISTRATION</div><h1>Overview</h1><p className="subtitle">A simple place to manage activation and subscriptions.</p></div><button className="primary" disabled><KeyRound size={17}/> Generate codes</button></div>
        <div className="notice"><CircleAlert size={19}/><div><strong>Backend connection not configured yet</strong><p>This is the initial interface. No user data or activation codes are being displayed or changed. Supabase authentication and secure admin functions must be connected before management actions are enabled.</p></div></div>
        <div className="stats"><article className="stat"><div className="stat-icon violet"><KeyRound size={19}/></div><span>Total codes</span><strong>—</strong><small>Waiting for secure connection</small></article><article className="stat"><div className="stat-icon blue"><BadgeCheck size={19}/></div><span>Active subscriptions</span><strong>—</strong><small>Waiting for secure connection</small></article><article className="stat"><div className="stat-icon green"><Users size={19}/></div><span>Registered users</span><strong>—</strong><small>Waiting for secure connection</small></article><article className="stat"><div className="stat-icon amber"><ChartNoAxesCombined size={19}/></div><span>Redemptions</span><strong>—</strong><small>Waiting for secure connection</small></article></div>
        <div className="lower-grid"><section className="panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Common administration tasks</p></div><Code2 size={19}/></div><div className="quick-list"><div><KeyRound/><span><strong>Create activation codes</strong><small>Generate single codes or batches with custom rules</small></span><LockKeyhole/></div><div><Users/><span><strong>Manage users</strong><small>Review accounts and their subscription status</small></span><LockKeyhole/></div><div><ArrowDownToLine/><span><strong>Export code batches</strong><small>Download generated codes securely</small></span><LockKeyhole/></div></div></section><section className="panel"><div className="panel-head"><div><h2>System status</h2><p>Connection and service health</p></div><Activity size={19}/></div><div className="health-row"><span><i className="pending"/> Supabase project</span><b>Not connected</b></div><div className="health-row"><span><i className="pending"/> Admin authentication</span><b>Not configured</b></div><div className="health-row"><span><i className="pending"/> Secure functions</span><b>Not verified</b></div><div className="health-foot">Management stays disabled until the backend is verified.</div></section></div>
        <footer><span>Omax Control Center</span><span>Initial setup · v0.1.0</span></footer>
      </section>
    </main>
  </div>;
}

export default App;
