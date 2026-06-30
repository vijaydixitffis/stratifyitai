import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOrg } from '../../contexts/SelectedOrgContext';
import { getOrCreateEngagement, Engagement } from '../../services/engagementService';
import {
  getCapabilityGaps, computeCapabilityGaps,
  CapabilityGapRow,
} from '../../services/capabilityGapService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const SKY = '#1a6fb5';
const INK = '#0d1117';
const GHOST2 = '#f4f6f9';

type GapType = CapabilityGapRow['gap_type'];

const GAP_CONFIG: Record<GapType, { label: string; bg: string; text: string; description: string }> = {
  'no-coverage':    { label: 'No Coverage',   bg: '#f7e7e5', text: '#a23a2f', description: 'No IT assets support this capability' },
  'under-served':   { label: 'Under-served',  bg: '#fdf1e5', text: '#8a4800', description: 'Weak asset coverage' },
  'adequate':       { label: 'Adequate',      bg: '#f4f6f9', text: '#4d5c6e', description: 'Acceptable coverage' },
  'well-served':    { label: 'Well-served',   bg: '#e7f9ef', text: '#1a6b40', description: 'Strong asset coverage' },
  'over-served':    { label: 'Over-served',   bg: '#ecebf6', text: '#403592', description: 'Redundant assets — rationalise' },
  'ai-priority-gap':{ label: 'AI Priority Gap',bg: '#e7f0f9', text: '#175a93', description: 'AI strategic priority — assets not ready' },
};

const PortfolioHeatmapsView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { selectedOrg } = useSelectedOrg();
  const orgId: number | undefined = isAdmin ? selectedOrg?.org_id : (user as any)?.org_id;

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [gaps, setGaps]             = useState<CapabilityGapRow[]>([]);
  const [capNames, setCapNames]     = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gapFilter, setGapFilter]   = useState<GapType | 'all'>('all');
  const [error, setError]           = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const eng = await getOrCreateEngagement(orgId);
      setEngagement(eng);
      if (!eng) { setLoading(false); return; }

      const [gapRows, capRes] = await Promise.all([
        getCapabilityGaps(eng.id),
        isSupabaseConfigured() && supabase
          ? supabase.from('business_capabilities').select('id, name').eq('org_id', orgId)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const names: Record<string, string> = {};
      for (const c of ((capRes as any).data ?? []) as Array<{ id: string; name: string }>) {
        names[c.id] = c.name;
      }
      setGaps(gapRows);
      setCapNames(names);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load heatmap data.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    if (!orgId || !engagement) return;
    setRefreshing(true);
    try {
      await computeCapabilityGaps(orgId, engagement.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const gapCounts = (Object.keys(GAP_CONFIG) as GapType[]).reduce(
    (acc, t) => ({ ...acc, [t]: gaps.filter(g => g.gap_type === t).length }),
    {} as Record<GapType, number>,
  );

  const filtered = gapFilter === 'all' ? gaps : gaps.filter(g => g.gap_type === gapFilter);
  const aiPriority = gaps.filter(g => g.is_ai_priority).length;

  if (!orgId) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <p style={{ color: 'var(--fg-3)' }}>{isAdmin ? 'Select an organisation.' : 'No organisation context.'}</p>
      </div>
    );
  }

  return (
    <div style={{ background: GHOST2, minHeight: '100%', padding: '28px 32px' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', color: SKY, marginBottom: 4 }}>
            The Way Forward
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: INK, margin: 0 }}>
            Portfolio Heatmaps
          </h1>
          <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 4 }}>
            Capability coverage analysis — where the portfolio is strong, weak, or missing
          </p>
        </div>
        {isAdmin && (
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: refreshing ? '#aab4c0' : SKY, color: '#fff', border: 'none', cursor: refreshing ? 'not-allowed' : 'pointer' }}>
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {refreshing ? 'Refreshing…' : 'Refresh Analysis'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: '#f7e7e5', color: '#a23a2f', fontSize: 14 }}>{error}</div>
      )}

      {/* Gap type summary strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        {(Object.entries(GAP_CONFIG) as [GapType, typeof GAP_CONFIG[GapType]][]).map(([type, cfg]) => (
          <button key={type} onClick={() => setGapFilter(gapFilter === type ? 'all' : type)}
            className="rounded-lg p-3 text-left transition-all"
            style={{
              background: gapFilter === type ? cfg.bg : '#fff',
              border: `2px solid ${gapFilter === type ? cfg.text : 'var(--border)'}`,
              cursor: 'pointer', boxShadow: 'var(--sh-sm)',
            }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: cfg.text, margin: '0 0 4px', lineHeight: 1 }}>
              {gapCounts[type] ?? 0}
            </p>
            <p style={{ fontSize: 11, fontWeight: 600, color: cfg.text, margin: 0, lineHeight: 1.3 }}>{cfg.label}</p>
          </button>
        ))}
      </div>

      {/* AI priority callout */}
      {aiPriority > 0 && (
        <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: '#e7f0f9', border: '1px solid #1a6fb5' }}>
          <LayoutGrid size={18} style={{ color: SKY, flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#145a93', margin: 0 }}>
            <strong>{aiPriority}</strong> capabilities marked as AI strategic priorities.
            {gaps.filter(g => g.is_ai_priority && (g.gap_type === 'no-coverage' || g.gap_type === 'ai-priority-gap')).length > 0 && (
              <> <span style={{ color: '#a23a2f' }}>
                {gaps.filter(g => g.is_ai_priority && (g.gap_type === 'no-coverage' || g.gap_type === 'ai-priority-gap')).length} have critical gaps
              </span> blocking AI initiatives.</>
            )}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: SKY }} />
        </div>
      ) : gaps.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center justify-center py-16 text-center"
          style={{ background: '#fff', border: '2px dashed var(--border)' }}>
          <LayoutGrid size={40} style={{ color: SKY, marginBottom: 12 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: INK, marginBottom: 8 }}>
            No capability analysis yet
          </p>
          <p style={{ color: 'var(--fg-3)', fontSize: 13, maxWidth: 440, marginBottom: 20 }}>
            Map assets to capabilities in the Landscape tab, then run the analysis to see coverage gaps.
          </p>
          {isAdmin && (
            <button onClick={handleRefresh} disabled={refreshing}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: SKY, color: '#fff', border: 'none', cursor: 'pointer' }}>
              {refreshing ? 'Refreshing…' : 'Run Gap Analysis'}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>
              {gapFilter === 'all' ? `${gaps.length} capabilities` : `${filtered.length} — ${GAP_CONFIG[gapFilter].label}`}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setGapFilter('all')}
                className="px-2.5 py-1 rounded-md text-xs font-semibold"
                style={{ background: gapFilter === 'all' ? SKY : 'transparent', color: gapFilter === 'all' ? '#fff' : 'var(--fg-3)', border: `1px solid ${gapFilter === 'all' ? SKY : 'transparent'}`, cursor: 'pointer' }}>
                All
              </button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-sunk)' }}>
                {['Capability', 'Gap Type', 'Assets', 'Avg Score', 'Importance', 'AI Priority', 'Recommendation'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left"
                    style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((gap, i) => {
                const cfg = GAP_CONFIG[gap.gap_type];
                const name = capNames[gap.capability_id] ?? `Capability ${gap.capability_id.slice(0, 6)}`;
                return (
                  <tr key={gap.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3" style={{ fontWeight: 600, color: INK, maxWidth: 200 }}>
                      <span className="block truncate">{name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: cfg.bg, color: cfg.text }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--fg-2)', textAlign: 'center' }}>
                      {gap.supporting_asset_count}
                    </td>
                    <td className="px-4 py-3">
                      {gap.avg_coverage_score !== null ? (
                        <div className="flex items-center gap-1.5">
                          <div style={{ width: 48, height: 5, background: '#e4e8ed', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                              width: `${gap.avg_coverage_score}%`, height: '100%', borderRadius: 99,
                              background: gap.avg_coverage_score >= 65 ? '#2f8f6b' : gap.avg_coverage_score >= 40 ? '#b07d1a' : '#c0473a',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{gap.avg_coverage_score}%</span>
                        </div>
                      ) : <span style={{ color: '#aab4c0' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {gap.strategic_importance ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: gap.strategic_importance === 'critical' ? '#f7e7e5' : gap.strategic_importance === 'high' ? '#fdf1e5' : '#f4f6f9',
                            color: gap.strategic_importance === 'critical' ? '#a23a2f' : gap.strategic_importance === 'high' ? '#8a4800' : '#4d5c6e',
                          }}>
                          {gap.strategic_importance}
                        </span>
                      ) : <span style={{ color: '#aab4c0' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {gap.is_ai_priority ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: '#e7f0f9', color: '#175a93' }}>
                          AI
                        </span>
                      ) : <span style={{ color: '#aab4c0' }}>—</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--fg-3)', fontSize: 12, maxWidth: 260 }}>
                      <span className="block truncate" title={gap.recommendation_hint ?? undefined}>
                        {gap.recommendation_hint ?? '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PortfolioHeatmapsView;
