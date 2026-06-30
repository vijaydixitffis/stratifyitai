import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { RefreshCw, AlertTriangle, CheckCircle, TrendingUp, Database, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOrg } from '../../contexts/SelectedOrgContext';
import { getOrCreateEngagement, Engagement } from '../../services/engagementService';
import { getAssetScores, scoreAllAssets, AssetScoreRecord } from '../../services/scoringService';
import { getAIReadinessProfile, computeAndSaveAIReadinessProfile, AIReadinessProfile } from '../../services/aiReadinessService';

const SKY = '#1a6fb5';
const INK = '#0d1117';
const GHOST2 = '#f4f6f9';

const TIER_CONFIG = {
  exploring:  { label: 'Exploring',  bg: '#f7e7e5', text: '#a23a2f' },
  developing: { label: 'Developing', bg: '#f6edda', text: '#8a6314' },
  scaling:    { label: 'Scaling',    bg: '#e7f0f9', text: '#175a93' },
  leading:    { label: 'Leading',    bg: '#e7f9ef', text: '#1a6b40' },
};

const AI_DIM_LABELS: Record<string, string> = {
  strategy_score:      'Strategy',
  tech_infra_score:    'Tech Infra',
  data_quality_score:  'Data Quality',
  operations_score:    'Operations',
  talent_score:        'Talent',
  finance_score:       'Finance',
  governance_score:    'Governance',
  dept_specific_score: 'Dept Ready',
};

function ScoreBrackets(scores: AssetScoreRecord[]) {
  const brackets = [
    { name: '0–20',  range: [0, 20],  count: 0, fill: '#c0473a' },
    { name: '21–40', range: [21, 40], count: 0, fill: '#b07d1a' },
    { name: '41–60', range: [41, 60], count: 0, fill: '#8a6314' },
    { name: '61–80', range: [61, 80], count: 0, fill: '#1a6fb5' },
    { name: '81–100',range: [81,100], count: 0, fill: '#2f8f6b' },
  ];
  for (const s of scores) {
    const c = s.composite_score;
    if (c === null) continue;
    for (const b of brackets) {
      if (c >= b.range[0] && c <= b.range[1]) { b.count++; break; }
    }
  }
  return brackets;
}

const StrategyInsightsView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { selectedOrg } = useSelectedOrg();
  const orgId: number | undefined = isAdmin ? selectedOrg?.org_id : (user as any)?.org_id;

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [scores, setScores]         = useState<AssetScoreRecord[]>([]);
  const [aiProfile, setAiProfile]   = useState<AIReadinessProfile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const eng = await getOrCreateEngagement(orgId);
      setEngagement(eng);
      if (eng) {
        const [sc, ai] = await Promise.all([
          getAssetScores(eng.id),
          getAIReadinessProfile(orgId, eng.id),
        ]);
        setScores(sc);
        setAiProfile(ai);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load strategy insights.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRunAnalysis = async () => {
    if (!orgId || !engagement) return;
    setRunning(true);
    try {
      await scoreAllAssets(orgId, engagement.id);
      await computeAndSaveAIReadinessProfile(orgId, engagement.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const published = scores.filter(s => s.published_at);
  const total = scores.length;
  const avgHealth = total > 0
    ? Math.round(scores.reduce((s, r) => s + (r.composite_score ?? 0), 0) / total)
    : null;
  const needsAttention = scores.filter(s => (s.composite_score ?? 101) < 40).length;
  const avgCompleteness = total > 0
    ? Math.round(scores.reduce((s, r) => s + r.data_completeness, 0) / total)
    : 0;

  const scoreBrackets = ScoreBrackets(scores);

  const radarData = aiProfile
    ? Object.entries(AI_DIM_LABELS).map(([key, label]) => ({
        subject: label,
        value: (aiProfile as any)[key] ?? 0,
        fullMark: 100,
      }))
    : [];

  if (!orgId) {
    return (
      <div style={{ background: GHOST2, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <Database size={40} style={{ color: SKY, margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: INK }}>
            {isAdmin ? 'Select an organisation to view strategy insights.' : 'No organisation context found.'}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: SKY }} />
      </div>
    );
  }

  return (
    <div style={{ background: GHOST2, minHeight: '100%', padding: '28px 32px' }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', color: SKY, marginBottom: 4 }}>
            Portfolio Intelligence
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: INK, margin: 0 }}>
            Strategy Insights
          </h1>
          {engagement && (
            <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 4 }}>
              Engagement: {engagement.name}
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={handleRunAnalysis}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: running ? '#aab4c0' : SKY,
              color: '#fff',
              border: 'none',
              cursor: running ? 'not-allowed' : 'pointer',
              boxShadow: running ? 'none' : 'var(--sh-sky)',
            }}
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {running ? 'Running…' : 'Run Analysis'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: '#f7e7e5', border: '1px solid #c0473a', color: '#a23a2f', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Assets Scored',    value: total,            suffix: '',  color: SKY,        icon: <Database size={20} /> },
          { label: 'Portfolio Health', value: avgHealth ?? '—', suffix: avgHealth !== null ? '/100' : '', color: avgHealth === null ? '#aab4c0' : avgHealth >= 65 ? '#2f8f6b' : avgHealth >= 40 ? '#b07d1a' : '#c0473a', icon: <TrendingUp size={20} /> },
          { label: 'Needs Attention',  value: needsAttention,   suffix: '',  color: needsAttention > 0 ? '#c0473a' : '#2f8f6b', icon: <AlertTriangle size={20} /> },
          { label: 'Data Completeness',value: `${avgCompleteness}%`, suffix: '', color: avgCompleteness >= 70 ? '#2f8f6b' : '#b07d1a', icon: <CheckCircle size={20} /> },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-5" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: 0 }}>
                {card.label}
              </p>
              <span style={{ color: card.color }}>{card.icon}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: card.color, margin: 0, lineHeight: 1 }}>
              {card.value}
              {card.suffix && <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--fg-3)' }}>{card.suffix}</span>}
            </p>
          </div>
        ))}
      </div>

      {total === 0 ? (
        /* ── Empty state ────────────────────────────────────────────────── */
        <div className="rounded-2xl flex flex-col items-center justify-center py-16 px-8 text-center"
          style={{ background: '#fff', border: '2px dashed var(--border)', boxShadow: 'var(--sh-sm)' }}>
          <TrendingUp size={48} style={{ color: SKY, marginBottom: 16 }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: INK, marginBottom: 8 }}>
            No scoring data yet
          </h2>
          <p style={{ color: 'var(--fg-3)', maxWidth: 480, marginBottom: 24, lineHeight: 1.6 }}>
            Add assets in the Landscape tab and run the analysis above to score your portfolio across 7 dimensions and generate strategy insights.
          </p>
          {isAdmin && (
            <button
              onClick={handleRunAnalysis}
              disabled={running}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: SKY, color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {running ? 'Running…' : 'Run Scoring Now'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Score distribution ──────────────────────────────────────── */}
          <div className="lg:col-span-2 rounded-xl p-5" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: INK, marginBottom: 16 }}>
              Score Distribution
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreBrackets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e8ed" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7a8d' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7a8d' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0d1117', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13 }}
                  cursor={{ fill: 'rgba(26,111,181,.08)' }}
                  formatter={(v: number) => [v, 'Assets']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {scoreBrackets.map((b, i) => (
                    <Cell key={i} fill={b.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Unpublished notice */}
            {published.length < total && (
              <p className="mt-3" style={{ fontSize: 12, color: '#b07d1a', background: '#f6edda', borderRadius: 6, padding: '6px 10px', display: 'inline-block' }}>
                {total - published.length} score{total - published.length !== 1 ? 's' : ''} not yet published — visible to admin only.
              </p>
            )}
          </div>

          {/* ── AI Readiness ─────────────────────────────────────────────── */}
          <div className="rounded-xl p-5 flex flex-col" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: INK, margin: 0 }}>
                AI Readiness
              </h3>
              {aiProfile?.maturity_tier && (() => {
                const cfg = TIER_CONFIG[aiProfile.maturity_tier];
                return (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: cfg.bg, color: cfg.text }}>
                    {cfg.label}
                  </span>
                );
              })()}
            </div>

            {aiProfile && radarData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                    <PolarGrid stroke="#e4e8ed" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7a8d' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="value" stroke={SKY} fill={SKY} fillOpacity={0.15} dot={{ r: 3, fill: SKY }} />
                  </RadarChart>
                </ResponsiveContainer>
                {aiProfile.tier_rationale && (
                  <p style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5, marginTop: 8 }}>
                    {aiProfile.tier_rationale}
                  </p>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 12 }}>
                  No AI readiness assessment data. Run the analysis to compute maturity scores from assessment responses.
                </p>
                {isAdmin && (
                  <button
                    onClick={handleRunAnalysis}
                    disabled={running}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: SKY, color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    Run Analysis
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Asset detail table ───────────────────────────────────────── */}
          <div className="lg:col-span-3 rounded-xl" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: INK, margin: 0 }}>
                Asset Scores
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-sunk)' }}>
                    {['Asset ID', 'Composite', 'Tech Health', 'Biz Fit', 'Cloud', 'Security', 'AI Ready', 'Op Risk', 'Cost', 'Completeness', 'Source'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scores.slice(0, 20).map((s, i) => (
                    <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-4 py-2.5" style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {s.asset_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2.5">
                        <span style={{
                          fontWeight: 700,
                          color: s.composite_score === null ? '#aab4c0' : s.composite_score >= 65 ? '#2f8f6b' : s.composite_score >= 40 ? '#b07d1a' : '#c0473a'
                        }}>
                          {s.composite_score !== null ? s.composite_score : '—'}
                        </span>
                      </td>
                      {(['technical_health', 'business_fit', 'cloud_readiness', 'security_posture', 'ai_readiness', 'operational_risk', 'cost_efficiency'] as const).map(dim => (
                        <td key={dim} className="px-4 py-2.5" style={{ color: 'var(--fg-2)' }}>
                          {s[dim] !== null ? `${s[dim]}/5` : <span style={{ color: '#aab4c0' }}>—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div style={{ width: 56, height: 5, background: '#e4e8ed', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${s.data_completeness}%`, height: '100%', background: s.data_completeness >= 70 ? '#2f8f6b' : '#b07d1a', borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{s.data_completeness}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                          background: s.scored_by === 'ai-engine' ? '#e7f0f9' : s.scored_by === 'manual' ? '#e7f9ef' : '#f4f6f9',
                          color: s.scored_by === 'ai-engine' ? '#175a93' : s.scored_by === 'manual' ? '#1a6b40' : '#6b7a8d' }}>
                          {s.scored_by}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scores.length > 20 && (
                <p className="px-5 py-3" style={{ fontSize: 12, color: 'var(--fg-3)', borderTop: '1px solid var(--border)' }}>
                  Showing 20 of {scores.length} assets.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyInsightsView;
