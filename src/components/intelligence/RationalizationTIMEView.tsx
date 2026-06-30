import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOrg } from '../../contexts/SelectedOrgContext';
import { getOrCreateEngagement, Engagement } from '../../services/engagementService';
import { getAssetScores, scoreAllAssets, publishAssetScores, AssetScoreRecord } from '../../services/scoringService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const SKY = '#1a6fb5';
const INK = '#0d1117';
const GHOST2 = '#f4f6f9';

type TIMEDisposition = 'invest' | 'tolerate' | 'migrate' | 'eliminate';

const TIME_CONFIG: Record<TIMEDisposition, { label: string; bg: string; text: string; desc: string }> = {
  invest:    { label: 'Invest',    bg: '#e7f0f9', text: '#175a93', desc: 'Strategic — enhance and grow' },
  tolerate:  { label: 'Tolerate', bg: '#f6edda', text: '#8a6314', desc: 'Acceptable — maintain as-is' },
  migrate:   { label: 'Migrate',  bg: '#ecebf6', text: '#403592', desc: 'Change needed — modernise or replace' },
  eliminate: { label: 'Eliminate',bg: '#f7e7e5', text: '#a23a2f', desc: 'Remove — retire and decommission' },
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  application:    '#1a6fb5',
  database:       '#2f8f6b',
  infrastructure: '#2c3e50',
  middleware:     '#b07d1a',
  'cloud-service':'#2f8fdb',
  'third-party':  '#6b7a8d',
};

function toTIME(disposition: string | null, businessFit: number | null, compositeScore: number | null): TIMEDisposition {
  if (disposition) {
    switch (disposition) {
      case 'retain':     return (businessFit !== null && businessFit >= 4) ? 'invest' : 'tolerate';
      case 'refactor':   return (businessFit !== null && businessFit >= 4) ? 'invest' : 'tolerate';
      case 'replatform': return (businessFit !== null && businessFit >= 3) ? 'tolerate' : 'migrate';
      case 'rehost':     return 'migrate';
      case 'replace':    return 'migrate';
      case 'retire':     return 'eliminate';
    }
  }
  if (compositeScore !== null) {
    if (compositeScore >= 70) return 'invest';
    if (compositeScore >= 50) return 'tolerate';
    if (compositeScore >= 25) return 'migrate';
    return 'eliminate';
  }
  return 'tolerate';
}

interface AssetRow extends AssetScoreRecord {
  asset_name: string;
  asset_type: string;
  time_disposition: TIMEDisposition;
}

const RationalizationTIMEView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { selectedOrg } = useSelectedOrg();
  const orgId: number | undefined = isAdmin ? selectedOrg?.org_id : (user as any)?.org_id;

  const [engagement, setEngagement]     = useState<Engagement | null>(null);
  const [rows, setRows]                 = useState<AssetRow[]>([]);
  const [filter, setFilter]             = useState<TIMEDisposition | 'all'>('all');
  const [loading, setLoading]           = useState(true);
  const [running, setRunning]           = useState(false);
  const [publishing, setPublishing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const eng = await getOrCreateEngagement(orgId);
      setEngagement(eng);
      if (!eng) { setLoading(false); return; }

      const [scores, assetRes] = await Promise.all([
        getAssetScores(eng.id),
        isSupabaseConfigured() && supabase
          ? supabase.from('it_assets').select('id, name, asset_type').eq('org_id', orgId)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const assetMap: Record<string, { name: string; type: string }> = {};
      for (const a of ((assetRes as any).data ?? []) as Array<{ id: string; name: string; asset_type: string }>) {
        assetMap[a.id] = { name: a.name, type: a.asset_type };
      }

      const enriched: AssetRow[] = scores.map(s => ({
        ...s,
        asset_name:       assetMap[s.asset_id]?.name ?? `Asset ${s.asset_id.slice(0, 6)}`,
        asset_type:       assetMap[s.asset_id]?.type ?? 'application',
        time_disposition: toTIME(s.recommended_disposition, s.business_fit, s.composite_score),
      }));
      setRows(enriched);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRunScoring = async () => {
    if (!orgId || !engagement) return;
    setRunning(true);
    try {
      await scoreAllAssets(orgId, engagement.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const handlePublish = async () => {
    if (!engagement) return;
    setPublishing(true);
    try {
      await publishAssetScores(engagement.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const timeCounts = (['invest', 'tolerate', 'migrate', 'eliminate'] as TIMEDisposition[]).reduce(
    (acc, t) => ({ ...acc, [t]: rows.filter(r => r.time_disposition === t).length }),
    {} as Record<TIMEDisposition, number>,
  );

  const filtered = filter === 'all' ? rows : rows.filter(r => r.time_disposition === filter);

  if (!orgId) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <p style={{ color: 'var(--fg-3)' }}>{isAdmin ? 'Select an organisation to view rationalisation.' : 'No organisation context.'}</p>
      </div>
    );
  }

  return (
    <div style={{ background: GHOST2, minHeight: '100%', padding: '28px 32px' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', color: SKY, marginBottom: 4 }}>
            Portfolio Intelligence
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: INK, margin: 0 }}>
            Rationalisation
          </h1>
          <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 4 }}>
            TIME disposition for each IT asset — Invest · Tolerate · Migrate · Eliminate
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunScoring} disabled={running}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: running ? '#aab4c0' : '#fff', color: running ? '#fff' : SKY, border: `1px solid ${running ? '#aab4c0' : SKY}`, cursor: running ? 'not-allowed' : 'pointer' }}
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Score Assets
            </button>
            <button
              onClick={handlePublish} disabled={publishing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: publishing ? '#aab4c0' : SKY, color: '#fff', border: 'none', cursor: publishing ? 'not-allowed' : 'pointer' }}
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : null}
              Publish Scores
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: '#f7e7e5', color: '#a23a2f', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* TIME summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {(['invest', 'tolerate', 'migrate', 'eliminate'] as TIMEDisposition[]).map(t => {
          const cfg = TIME_CONFIG[t];
          return (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? 'all' : t)}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: filter === t ? cfg.bg : '#fff',
                border: `2px solid ${filter === t ? cfg.text : 'var(--border)'}`,
                cursor: 'pointer',
                boxShadow: 'var(--sh-sm)',
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: cfg.text, marginBottom: 6 }}>
                {cfg.label}
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: cfg.text, margin: 0, lineHeight: 1 }}>
                {timeCounts[t] ?? 0}
              </p>
              <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{cfg.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Filter strip */}
      <div className="flex items-center gap-2 mb-4">
        <Filter size={14} style={{ color: 'var(--fg-3)' }} />
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Filter:</span>
        {(['all', 'invest', 'tolerate', 'migrate', 'eliminate'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
            style={{
              background: filter === f ? (f === 'all' ? SKY : TIME_CONFIG[f as TIMEDisposition].bg) : 'transparent',
              color: filter === f ? (f === 'all' ? '#fff' : TIME_CONFIG[f as TIMEDisposition].text) : 'var(--fg-3)',
              border: `1px solid ${filter === f ? (f === 'all' ? SKY : TIME_CONFIG[f as TIMEDisposition].text) : 'var(--border)'}`,
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'All Assets' : TIME_CONFIG[f as TIMEDisposition].label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: SKY }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center justify-center py-14 text-center"
          style={{ background: '#fff', border: '2px dashed var(--border)' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: INK, marginBottom: 8 }}>
            {rows.length === 0 ? 'No asset scores yet' : `No assets in "${filter}" category`}
          </p>
          <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>
            {rows.length === 0
              ? 'Run asset scoring from the Strategy Insights tab to generate TIME dispositions.'
              : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-sunk)' }}>
                {['Asset', 'Type', 'TIME', 'Score', 'Biz Fit', 'Tech Health', 'Cost', '6R Disposition', 'Completeness'].map(h => (
                  <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const timeCfg = TIME_CONFIG[row.time_disposition];
                const typeColor = ASSET_TYPE_COLORS[row.asset_type] ?? '#6b7a8d';
                return (
                  <tr key={row.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3" style={{ fontWeight: 600, color: INK, maxWidth: 200 }}>
                      <span className="block truncate">{row.asset_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: `${typeColor}18`, color: typeColor }}>
                        {row.asset_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: timeCfg.bg, color: timeCfg.text }}>
                        {timeCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ fontWeight: 700, color: row.composite_score === null ? '#aab4c0' : row.composite_score >= 65 ? '#2f8f6b' : row.composite_score >= 40 ? '#b07d1a' : '#c0473a' }}>
                      {row.composite_score !== null ? row.composite_score : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--fg-2)' }}>{row.business_fit !== null ? `${row.business_fit}/5` : '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--fg-2)' }}>{row.technical_health !== null ? `${row.technical_health}/5` : '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--fg-2)' }}>{row.cost_efficiency !== null ? `${row.cost_efficiency}/5` : '—'}</td>
                    <td className="px-4 py-3">
                      <span style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: row.recommended_disposition ? 'normal' : 'italic' }}>
                        {row.recommended_disposition ?? 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div style={{ width: 48, height: 4, background: '#e4e8ed', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${row.data_completeness}%`, height: '100%', background: row.data_completeness >= 70 ? '#2f8f6b' : '#b07d1a', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{row.data_completeness}%</span>
                      </div>
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

export default RationalizationTIMEView;
