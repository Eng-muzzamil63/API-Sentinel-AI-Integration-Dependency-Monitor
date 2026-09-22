'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  CloudCog,
  Code2,
  Cpu,
  Database,
  GitBranch,
  Layers3,
  Link2,
  Network,
  Play,
  Radar,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Zap,
} from 'lucide-react'

type Service = {
  id: string
  name: string
  kind: string
  owner: string
  status: string
  latency: number
  error_rate: number
  version: string
  vendor: string
}

type Change = {
  id: string
  service_id: string
  title: string
  category: string
  severity: string
  detected: string
  before: string
  after: string
  confidence: number
  service: string
  vendor: string
}

type Edge = { source: string; target: string; type: string; criticality: string; sla: number }
type Node = Service & { x: number; y: number }
type Incident = { id: string; title: string; status: string; severity: string; service: string; started: string; impact: string; root_change: string }
type Impact = {
  change: Change
  blast_radius: number
  impacted_services: { service_id: string; service: string; type: string; criticality: string; relationship: string; confidence: number; reason: string }[]
  affected_workflows: string[]
  recommended_actions: string[]
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

const kindIcon: Record<string, any> = {
  SaaS: CloudCog,
  AI: Cpu,
  'AI Agent': Sparkles,
  Workflow: GitBranch,
  Data: Database,
}

function StatusDot({ status }: { status: string }) {
  return <span className={`status-dot ${status}`} aria-hidden="true" />
}

function SeverityPill({ severity }: { severity: string }) {
  return <span className={`severity-pill ${severity}`}>{severity}</span>
}

function Metric({ icon: Icon, label, value, meta, tone = '' }: { icon: any; label: string; value: string | number; meta: string; tone?: string }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-top"><span className="metric-icon"><Icon size={17} /></span><span>{meta}</span></div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function Sparkline({ values, warning = false }: { values: number[]; warning?: boolean }) {
  const w = 220, h = 62
  const min = Math.min(...values), max = Math.max(...values)
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / Math.max(1, max - min)) * (h - 8) - 4
    return `${x},${y}`
  }).join(' ')
  return <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} role="img"><polyline points={points} fill="none" stroke={warning ? 'var(--amber)' : 'var(--cyan)'} strokeWidth="3" strokeLinecap="round" /></svg>
}

function DependencyGraph({ nodes, edges, onChange }: { nodes: Node[]; edges: Edge[]; onChange: (id: string) => void }) {
  const positions: Record<string, [number, number]> = {
    'svc-leadbot': [118, 84],
    'svc-support': [118, 244],
    'svc-invoice': [118, 404],
    'svc-hubspot': [382, 78],
    'svc-openai': [382, 236],
    'svc-salesforce': [382, 394],
    'svc-stripe': [638, 92],
    'svc-slack': [638, 228],
    'svc-postgres': [638, 364],
    'svc-data': [858, 228],
  }
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  return (
    <div className="graph-canvas">
      <svg className="graph-lines" viewBox="0 0 960 490" preserveAspectRatio="none">
        {edges.map((e, i) => {
          const a = positions[e.source] || [0, 0]
          const b = positions[e.target] || [0, 0]
          const hot = e.criticality === 'critical'
          return <line key={i} x1={a[0] + 84} y1={a[1] + 34} x2={b[0] + 10} y2={b[1] + 34} stroke={hot ? 'rgba(255,174,67,.6)' : 'rgba(112,147,185,.26)'} strokeWidth={hot ? 2.4 : 1.5} strokeDasharray={e.type === 'WEBHOOK' ? '7 6' : undefined} />
        })}
      </svg>
      <div className="graph-grid" />
      {Object.entries(positions).map(([id, [x, y]]) => {
        const node = byId[id]
        const Icon = kindIcon[node?.kind] || Network
        return (
          <button key={id} className={`graph-node ${node?.status}`} style={{ left: x, top: y }} onClick={() => id === 'svc-hubspot' && onChange('chg-1048')}>
            <span className="graph-node-icon"><Icon size={15} /></span>
            <span className="graph-node-copy"><strong>{node?.name}</strong><small>{node?.kind}</small></span>
            <StatusDot status={node?.status || 'healthy'} />
          </button>
        )
      })}
      <div className="graph-legend">
        <span><i className="legend-line critical" /> critical dependency</span>
        <span><i className="legend-line" /> normal dependency</span>
        <span><i className="legend-dash" /> webhook</span>
      </div>
    </div>
  )
}

export default function Home() {
  const [services, setServices] = useState<Service[]>([])
  const [changes, setChanges] = useState<Change[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [graph, setGraph] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  const [dashboard, setDashboard] = useState<any>(null)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNav, setSelectedNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [selectedChange, setSelectedChange] = useState('chg-1048')
  const [showSimulator, setShowSimulator] = useState(false)
  const [simTitle, setSimTitle] = useState('New breaking API contract')
  const [simSeverity, setSimSeverity] = useState('high')
  const [simService, setSimService] = useState('svc-hubspot')
  const [simulated, setSimulated] = useState<Change | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [d, s, c, g, i] = await Promise.all([
        fetch(`${API}/api/dashboard`).then(r => r.json()),
        fetch(`${API}/api/services`).then(r => r.json()),
        fetch(`${API}/api/changes`).then(r => r.json()),
        fetch(`${API}/api/dependencies`).then(r => r.json()),
        fetch(`${API}/api/incidents`).then(r => r.json()),
      ])
      setDashboard(d); setServices(s); setChanges(c); setGraph(g); setIncidents(i)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!selectedChange) return
    fetch(`${API}/api/impact/${selectedChange}`).then(r => r.json()).then(setImpact)
  }, [selectedChange])

  const filteredChanges = useMemo(() => changes.filter(c => `${c.title} ${c.service} ${c.category}`.toLowerCase().includes(query.toLowerCase())), [changes, query])
  const highRisk = services.filter(s => s.status === 'at-risk' || s.status === 'degraded')

  async function simulate() {
    const res = await fetch(`${API}/api/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_id: simService, title: simTitle, severity: simSeverity }) })
    const data = await res.json()
    setSimulated(data.change); setSelectedChange(data.change.id); setImpact(data.analysis); setShowSimulator(false); await load()
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Radar size={21} /></div><div><strong>API Sentinel</strong><span>integration control plane</span></div></div>
        <div className="workspace"><span>Workspace</span><strong>Acme AI Platform</strong><small>Production · us-east-1</small></div>
        <nav>
          {['Overview', 'Dependency Graph', 'Changes', 'Incidents', 'Services'].map(item => (
            <button key={item} className={selectedNav === item ? 'active' : ''} onClick={() => setSelectedNav(item)}><span>{item === 'Overview' ? <Activity size={16} /> : item === 'Dependency Graph' ? <Network size={16} /> : item === 'Changes' ? <Zap size={16} /> : item === 'Incidents' ? <AlertTriangle size={16} /> : <Boxes size={16} />}</span>{item}</button>
          ))}
        </nav>
        <div className="side-divider" />
        <div className="sidebar-section"><span>Control</span><button><ShieldCheck size={16} />Policies</button><button><TerminalSquare size={16} />Contract tests</button><button><Bell size={16} />Alert routing</button></div>
        <div className="sidebar-footer"><div className="pulse"><span />Monitoring 47 services</div><small>Last scan · 18 sec ago</small></div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Control Plane</span><ChevronRight size={14} /><strong>{selectedNav}</strong></div>
          <div className="top-actions"><div className="search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search services, changes…" /></div><button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={16} /></button><button className="avatar">MA</button></div>
        </header>

        <div className="content">
          <section className="hero-row">
            <div><div className="eyebrow"><span className="live-dot" /> LIVE DEPENDENCY INTELLIGENCE</div><h1>Know what changed<br /><em>before production breaks.</em></h1><p>Track SaaS and API changes across AI agents, automations, data systems and business workflows — then trace the blast radius in seconds.</p></div>
            <div className="hero-actions"><button className="ghost-btn" onClick={() => setShowSimulator(true)}><Play size={15} /> Simulate change</button><button className="primary-btn" onClick={() => setSelectedNav('Dependency Graph')}><Network size={15} /> Open dependency graph</button></div>
          </section>

          {loading || !dashboard ? <div className="loading">Loading control plane…</div> : <>
            <section className="metrics-grid">
              <Metric icon={ServerCog} label="services monitored" value={dashboard.metrics.services_monitored} meta="+3 this week" />
              <Metric icon={Link2} label="active dependencies" value={dashboard.metrics.active_dependencies} meta="99.1% mapped" />
              <Metric icon={Zap} label="changes in 24h" value={dashboard.metrics.changes_24h} meta="4 high signal" tone="amber" />
              <Metric icon={AlertTriangle} label="workflows at risk" value={dashboard.metrics.impacted_workflows} meta="needs review" tone="rose" />
              <Metric icon={ShieldCheck} label="incidents prevented" value={dashboard.metrics.prevented_incidents} meta="30 day window" />
            </section>

            <section className="main-grid">
              <div className="panel span-8">
                <div className="panel-header"><div><span className="panel-kicker">SYSTEM TOPOLOGY</span><h2>Dependency graph</h2><p>Critical paths are highlighted. Select a changed service to inspect downstream impact.</p></div><div className="panel-actions"><span className="mini-status"><StatusDot status="healthy" /> 43 healthy</span><span className="mini-status"><StatusDot status="degraded" /> 2 degraded</span><span className="mini-status"><StatusDot status="at-risk" /> 2 at risk</span></div></div>
                <DependencyGraph nodes={graph.nodes} edges={graph.edges} onChange={setSelectedChange} />
              </div>

              <div className="right-column">
                <div className="panel pulse-panel">
                  <div className="panel-header compact"><div><span className="panel-kicker">RUNTIME PULSE</span><h2>Integration latency</h2></div><span className="live-badge">LIVE</span></div>
                  <div className="big-number">497<span>ms</span></div><div className="delta"><ArrowDownRight size={14} /> 8.3% vs previous hour</div><Sparkline values={(dashboard.latency_series || []).map((x: any) => x.value)} /><div className="signal-row"><span><b>2.8%</b> max error rate</span><span><b>99.82%</b> availability</span></div>
                </div>
                <div className="panel attention-panel"><div className="panel-header compact"><div><span className="panel-kicker">NEEDS ATTENTION</span><h2>{highRisk.length} services</h2></div><AlertTriangle size={18} /></div>{highRisk.map(s => <div className="attention-item" key={s.id}><div><StatusDot status={s.status} /><strong>{s.name}</strong></div><span>{s.error_rate}% errors</span></div>)}</div>
              </div>
            </section>

            <section className="three-grid">
              <div className="panel change-panel">
                <div className="panel-header compact"><div><span className="panel-kicker">CHANGE INTELLIGENCE</span><h2>Detected API changes</h2></div><button className="text-btn">View all <ArrowRight size={14} /></button></div>
                <div className="table-head"><span>Change</span><span>Severity</span><span>Confidence</span></div>
                {filteredChanges.slice(0, 4).map(c => <button className={`change-row ${selectedChange === c.id ? 'selected' : ''}`} key={c.id} onClick={() => setSelectedChange(c.id)}><div className="change-main"><span className="change-icon"><Code2 size={15} /></span><div><strong>{c.title}</strong><span>{c.service} · {c.detected}</span></div></div><SeverityPill severity={c.severity} /><div className="confidence"><div><span style={{ width: `${c.confidence * 100}%` }} /></div><b>{Math.round(c.confidence * 100)}%</b></div></button>)}
              </div>

              <div className="panel impact-panel">
                <div className="panel-header compact"><div><span className="panel-kicker">BLAST RADIUS</span><h2>Impact analysis</h2></div><span className="risk-score">{impact?.blast_radius ?? '—'} / 100</span></div>
                {impact ? <><div className="impact-hero"><div className="impact-ring" style={{ '--p': `${impact.blast_radius}%` } as CSSProperties}><strong>{impact.blast_radius}</strong><span>risk</span></div><div><span className="impact-title">{impact.change.title}</span><p>{impact.change.vendor} · {impact.change.category}</p><div className="impact-tag"><CircleDot size={13} /> {impact.impacted_services.length} downstream services</div></div></div><div className="impact-list">{impact.impacted_services.slice(0, 3).map(x => <div className="impact-line" key={x.service_id}><div><StatusDot status={x.criticality === 'critical' ? 'at-risk' : 'degraded'} /><strong>{x.service}</strong><span>{x.relationship} · {x.type}</span></div><b>{Math.round(x.confidence * 100)}%</b></div>)}</div><button className="full-btn" onClick={() => setSelectedNav('Dependency Graph')}>Open root-cause trail <ChevronRight size={15} /></button></> : <div className="empty">Select a change to calculate impact.</div>}
              </div>

              <div className="panel incident-panel">
                <div className="panel-header compact"><div><span className="panel-kicker">INCIDENT RESPONSE</span><h2>Open incidents</h2></div><button className="text-btn">Timeline <ArrowRight size={14} /></button></div>
                {incidents.map(i => <div className="incident-row" key={i.id}><div className="incident-top"><span className="incident-id">{i.id}</span><SeverityPill severity={i.severity} /></div><strong>{i.title}</strong><p>{i.service} · {i.started}</p><div className="incident-foot"><span>{i.impact}</span><span className={`incident-status ${i.status}`}>{i.status}</span></div></div>)}
              </div>
            </section>

            <section className="panel bottom-strip"><div className="bottom-icon"><Sparkles size={18} /></div><div><span className="panel-kicker">AUTOMATED RECOMMENDATION</span><h3>HubSpot contract change is currently the highest-risk dependency signal.</h3><p>Lead Qualification Agent → HubSpot API → Growth workflows. Contract confidence is 97%. Run the compatibility test suite before restoring normal traffic.</p></div><button className="primary-btn small" onClick={() => setSelectedChange('chg-1048')}>Investigate <ArrowRight size={14} /></button></section>
          </>}
        </div>
      </section>

      {showSimulator && <div className="modal-backdrop" onMouseDown={() => setShowSimulator(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="panel-kicker">SCENARIO LAB</span><h2>Simulate an API change</h2><p>Test your dependency graph without touching production.</p></div><button className="icon-btn" onClick={() => setShowSimulator(false)}>×</button></div><label>Service<select value={simService} onChange={e => setSimService(e.target.value)}>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Change description<input value={simTitle} onChange={e => setSimTitle(e.target.value)} /></label><label>Severity<select value={simSeverity} onChange={e => setSimSeverity(e.target.value)}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><div className="modal-callout"><ShieldCheck size={17} /><span>This simulation calculates downstream services, affected workflows and recommended remediation steps.</span></div><div className="modal-foot"><button className="ghost-btn" onClick={() => setShowSimulator(false)}>Cancel</button><button className="primary-btn" onClick={simulate}><Zap size={15} /> Analyze blast radius</button></div></div></div>}
    </main>
  )
}
