import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAssets } from '../contexts/AssetContext';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import { Building, Loader2 } from 'lucide-react';
import { getPortfolioReviewSummary, type PortfolioReviewSummary } from '../services/assetReviewService';
import { usePhase } from '../contexts/PhaseContext';

interface DashboardProps {
  onNavigate: (tab: string, subTab?: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatCrore = (amount: number): string => {
  const cr = amount / 10_000_000;
  if (cr >= 1) return `₹${cr.toFixed(1)} Cr`;
  const lakh = amount / 100_000;
  if (lakh >= 1) return `₹${lakh.toFixed(0)} L`;
  return `₹${(amount / 1000).toFixed(0)}K`;
};

const DonutChart: React.FC<{ score: number; color: string }> = ({ score, color }) => {
  const r = 62;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div style={{ position: 'relative', width: 168, height: 168, flexShrink: 0 }}>
      <svg width="168" height="168" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="84" cy="84" r={r} fill="none" stroke="var(--ghost)" strokeWidth="22" />
        <circle cx="84" cy="84" r={r} fill="none" stroke={color} strokeWidth="22"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 44, color, letterSpacing: '-.03em', lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 2 }}>out of 100</span>
      </div>
    </div>
  );
};

// ── Stat card icons ──────────────────────────────────────────────────────────

const StatIcon = ({ type }: { type: string }) => {
  const s: React.CSSProperties = { width: 18, height: 18 };
  if (type === 'stack') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>
    </svg>
  );
  if (type === 'check') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
    </svg>
  );
  if (type === 'warn') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
  if (type === 'trash') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
    </svg>
  );
  if (type === 'rupee') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3a4 4 0 0 0 0-8"/>
    </svg>
  );
  // eliminate / layers
  return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  );
};

// ── Main Dashboard ───────────────────────────────────────────────────────────

const MATURITY_DOMAINS = [
  { name: 'Security & Compliance',     color: '#2f8f6b', pct: 74 },
  { name: 'Cloud Readiness',           color: '#b07d1a', pct: 66 },
  { name: 'Data & Analytics',          color: '#b07d1a', pct: 63 },
  { name: 'Operational Resilience',    color: '#b07d1a', pct: 57 },
  { name: 'Integration Architecture',  color: '#c0473a', pct: 49 },
  { name: 'Application Modernisation', color: '#c0473a', pct: 42 },
];

const AGENT_BRIEFING =
  'A trading-grade core (NEST, AWS R1, lakehouse) is healthy, but the estate carries an eight-DC footprint and a legacy trading/back-office tail. Quickest wins: eliminate sunset middleware; the structural play is data-centre consolidation and the CLASS+→N-Prime move.';

const RAG_LABELS: Record<string, string> = {
  red:   'RAG Red · At Risk',
  amber: 'RAG Amber · Developing',
  green: 'RAG Green · On Track',
};
const RAG_COLORS: Record<string, string> = {
  red:   'var(--rag-red)',
  amber: 'var(--rag-amber)',
  green: 'var(--rag-green)',
};
const RAG_BG: Record<string, string> = {
  red:   '#f7e7e5',
  amber: '#f6edda',
  green: '#e4f1eb',
};
const RAG_BORDER: Record<string, string> = {
  red:   '#eccfcb',
  amber: '#ecdcba',
  green: '#b8ddc8',
};
const RAG_TEXT: Record<string, string> = {
  red:   '#8a2318',
  amber: '#8a6314',
  green: '#1f6b47',
};

const getRAG = (score: number) => {
  if (score >= 70) return 'green';
  if (score >= 45) return 'amber';
  return 'red';
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, isAdmin } = useAuth();
  const { assets, loading } = useAssets();
  const { selectedOrg } = useSelectedOrg();
  const { currentPhase } = usePhase();
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioReviewSummary | null>(null);

  const orgId: number = (isAdmin && selectedOrg)
    ? selectedOrg.org_id
    : (user?.org_id ?? 0);

  useEffect(() => {
    if (!orgId || !assets.length) return;
    getPortfolioReviewSummary(orgId, assets.length)
      .then(setPortfolioSummary)
      .catch(() => {});
  }, [orgId, assets.length]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <Loader2 style={{ width: 28, height: 28, color: 'var(--sky)' }} className="animate-spin" />
        <span style={{ marginLeft: 10, color: 'var(--fg-3)', font: 'var(--t-small)' }}>Loading dashboard…</span>
      </div>
    );
  }

  // ── Admin empty state ────────────────────────────────────────────────────
  if (isAdmin && (user as any)?.orgCode === 'ADMIN' && !selectedOrg) {
    return (
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 32px', textAlign: 'center' }}>
        <Building style={{ width: 52, height: 52, color: 'var(--sky)', margin: '0 auto 16px' }} />
        <h1 style={{ font: 'var(--t-h2)', color: 'var(--fg-2)', margin: '0 0 12px' }}>Welcome to StratifyIT.ai</h1>
        <p style={{ font: 'var(--t-body)', color: 'var(--fg-3)', margin: '0 0 40px' }}>
          Select a client organisation from the dropdown above to view their IT rationalisation journey.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 600, margin: '0 auto' }}>
          {['Know your Landscape', 'Portfolio Intelligence', 'The Way Forward'].map((label, i) => (
            <div key={i} style={{ padding: 20, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', textAlign: 'left' }}>
              <div style={{ font: 'var(--t-small)', fontWeight: 700, color: 'var(--fg-2)', marginBottom: 4 }}>Phase {i + 1}</div>
              <div style={{ font: 'var(--t-small)', color: 'var(--fg-3)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Computed stats ───────────────────────────────────────────────────────
  const total      = assets.length;
  const active     = assets.filter(a => a.status === 'active').length;
  const highCrit   = assets.filter(a => a.criticality === 'high').length;
  const deprecated = assets.filter(a => a.status === 'deprecated').length;
  const annualCost = assets.reduce((s, a) => s + (a.annual_cost ?? 0), 0);
  const toEliminate = assets.filter(a => a.metadata?.time_disposition === 'eliminate').length;

  // Modernisation index: weighted from TIME dispositions
  const dispWeights: Record<string, number> = { invest: 80, migrate: 60, tolerate: 45, eliminate: 15 };
  const assetsWithDisp = assets.filter(a => a.metadata?.time_disposition);
  const modScore = assetsWithDisp.length
    ? Math.round(assetsWithDisp.reduce((s, a) => s + (dispWeights[a.metadata.time_disposition] ?? 40), 0) / assetsWithDisp.length)
    : 0;
  const rag = getRAG(modScore);

  const orgName = (isAdmin && selectedOrg) ? selectedOrg.org_name : (user as any)?.organization ?? '';
  const sector  = (isAdmin && selectedOrg) ? ((selectedOrg as any).sector ?? '') : '';

  // Review progress
  const reviewed   = portfolioSummary?.addressed ?? 0;
  const questionnaire = portfolioSummary?.questionnaire ?? 0;
  const notStarted = total - reviewed - questionnaire;
  const reviewedPct = total > 0 ? ((reviewed / total) * 100).toFixed(1) : '0';

  // Subtitle: last analysed (from portfolio summary or fallback)
  const assetCountLabel = `${total}-asset estate`;
  const subtitle = [sector, assetCountLabel, 'last analysed recently'].filter(Boolean).join(' · ');

  const STAT_CARDS = [
    { icon: 'stack', tint: 'var(--sky-50)',  color: 'var(--sky)',     value: total,       label: 'Total assets',    sub: 'CMDB + manual' },
    { icon: 'check', tint: '#e4f1eb',         color: '#2f8f6b',        value: active,      label: 'Active',          sub: 'in service' },
    { icon: 'warn',  tint: '#f7e7e5',         color: 'var(--rag-red)', value: highCrit,    label: 'High criticality', sub: 'mission-critical' },
    { icon: 'trash', tint: '#fff3f2',         color: 'var(--rag-red)', value: deprecated,  label: 'Deprecated',      sub: 'flagged to retire' },
    { icon: 'rupee', tint: '#f0f7ed',         color: '#2f8f6b',        value: annualCost > 0 ? formatCrore(annualCost) : '—', label: 'Annual run-rate', sub: 'portfolio OPEX' },
    { icon: 'layers',tint: 'var(--n-50)',     color: 'var(--n-500)',   value: toEliminate, label: 'To eliminate',    sub: 'TIME disposition' },
  ];

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: 32 }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sky)', margin: '0 0 6px' }}>
          Rationalisation journey · Phase {currentPhase} of 3
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ font: 'var(--t-h1)', color: 'var(--fg-2)', letterSpacing: '-.02em', margin: 0 }}>
            {orgName || 'Your Organisation'}
          </h1>
          <span style={{ font: 'var(--t-small)', color: 'var(--fg-4)' }}>{subtitle}</span>
        </div>
      </div>

      {/* ── 6 Stat cards ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 14 }}>
        {STAT_CARDS.map((st, i) => (
          <div key={i} style={{
            background: '#fff', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: 16, boxShadow: 'var(--sh-sm)',
          }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 'var(--r-xs)',
                background: st.tint, color: st.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <StatIcon type={st.icon} />
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-.03em', color: 'var(--fg-2)', lineHeight: 1.05 }}>
              {st.value}
            </div>
            <div style={{ font: 'var(--t-small)', color: 'var(--fg-2)', fontWeight: 600, marginTop: 6 }}>{st.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 1 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Asset review progress ────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px 20px', boxShadow: 'var(--sh-sm)', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ font: 'var(--t-small)', fontWeight: 700, color: 'var(--fg-2)' }}>
            Asset review progress{' '}
            <span style={{ fontWeight: 500, color: 'var(--fg-4)' }}>
              · {reviewed} of {total} reviewed ({reviewedPct}%)
            </span>
          </span>
          <button
            onClick={() => onNavigate('landscape', 'assets')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--sky)', font: 'var(--t-small)', fontWeight: 600, cursor: 'pointer' }}
          >
            Continue review
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--ghost)', overflow: 'hidden', display: 'flex' }}>
          {reviewed > 0 && (
            <div style={{ width: `${(reviewed / total) * 100}%`, background: 'var(--success)' }} />
          )}
          {questionnaire > 0 && (
            <div style={{ width: `${(questionnaire / total) * 100}%`, background: 'var(--warning)' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 9, font: 'var(--t-small)', color: 'var(--fg-3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
            Reviewed {reviewed}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} />
            Questionnaire {questionnaire}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--n-300)' }} />
            Not started {notStarted}
          </span>
        </div>
      </div>

      {/* ── Executive Briefing ──────────────────────────────────────────── */}
      <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--fg-4)', margin: '0 0 12px' }}>
        Executive briefing
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '.85fr 1.15fr 1fr', gap: 16 }}>

        {/* Modernisation Index */}
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: 24, boxShadow: 'var(--sh-sm)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', justifyContent: 'center',
        }}>
          <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sky)', margin: '0 0 16px' }}>
            Modernisation index
          </p>
          <DonutChart score={modScore || 0} color={RAG_COLORS[rag]} />
          <div style={{ marginTop: 16 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 'var(--r-pill)',
              background: RAG_BG[rag], border: `1px solid ${RAG_BORDER[rag]}`,
              font: 'var(--t-small)', fontWeight: 600, color: RAG_TEXT[rag],
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: RAG_COLORS[rag] }} />
              {RAG_LABELS[rag]}
            </span>
          </div>
        </div>

        {/* Maturity across 6 domains */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 24, boxShadow: 'var(--sh-sm)' }}>
          <h3 style={{ font: 'var(--t-h4)', color: 'var(--fg-2)', margin: '0 0 16px' }}>Maturity across 6 domains</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {MATURITY_DOMAINS.map((d, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ font: 'var(--t-small)', color: 'var(--fg-2)' }}>{d.name}</span>
                  <span style={{ font: 'var(--t-small)', fontWeight: 600, color: d.color }}>{d.pct}%</span>
                </div>
                <div style={{ height: 7, background: 'var(--ghost)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${d.pct}%`, background: d.color, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent briefing */}
        <div style={{ background: 'var(--ink)', borderRadius: 'var(--r-md)', padding: 24, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 100% 0%, rgba(47,143,219,.26), transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 'var(--r-xs)', background: 'var(--sky)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
                  <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01"/>
                </svg>
              </span>
              <h3 style={{ font: 'var(--t-h4)', color: '#fff', margin: 0 }}>Agent briefing</h3>
            </div>
            <p style={{ font: 'var(--t-small)', color: 'var(--fgd-2)', margin: '0 0 16px', lineHeight: 1.55, flex: 1 }}>
              {AGENT_BRIEFING}
            </p>
            <button
              onClick={() => onNavigate('intelligence', 'rationalization')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
                background: 'var(--sky)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)',
                padding: '9px 15px', font: 'var(--t-small)', fontWeight: 600, cursor: 'pointer',
              }}
            >
              View rationalisation
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </main>
  );
};

export default Dashboard;
