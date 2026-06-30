import React, { useState, useEffect, useCallback } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import {
  Plus,
  Upload,
  Search,
  Edit,
  Trash2,
  Database,
  Server,
  Cloud,
  Settings,
  Globe,
  Package,
  Loader2,
  AlertCircle,
  RefreshCw,
  Brain,
  Pencil,
} from 'lucide-react';
import AssetForm from './AssetForm';
import AssetUpload from './AssetUpload';
import AssetReviewPanel from './AssetReviewPanel';
import { ManualMappingModal } from './landscape/CapabilityMapper';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AssetReviewService, getPortfolioReviewSummary, runRationalization, type PortfolioReviewSummary } from '../services/assetReviewService';
import type { AssetReview } from '../types/assetReview';

// ── Design tokens ─────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { color: string; tint: string; label: string }> = {
  'application':         { color: '#1a6fb5', tint: 'var(--sky-50)',  label: 'Application' },
  'database':            { color: '#2f8f6b', tint: '#e8f3ee',        label: 'Database' },
  'infrastructure':      { color: '#2c3e50', tint: '#eceff2',        label: 'Infrastructure' },
  'middleware':          { color: '#b07d1a', tint: '#f6edda',        label: 'Middleware' },
  'cloud-service':       { color: '#2f8fdb', tint: '#eaf3fb',        label: 'Cloud Service' },
  'third-party-service': { color: '#6b7a8d', tint: '#eef1f4',        label: 'Third-party' },
};

const TIME_META: Record<string, { bg: string; fg: string; bd: string }> = {
  invest:   { bg: '#e7f0f9', fg: '#175a93', bd: '#cfe0f1' },
  tolerate: { bg: '#f6edda', fg: '#8a6314', bd: '#ecdcba' },
  migrate:  { bg: '#ecebf6', fg: '#403592', bd: '#dad7ee' },
  eliminate:{ bg: '#f7e7e5', fg: '#a23a2f', bd: '#eccfcb' },
};

const STATUS_META: Record<string, { bg: string; fg: string; bd: string }> = {
  active:     { bg: '#e4f1eb', fg: '#1f6b47', bd: '#b8ddc8' },
  inactive:   { bg: 'var(--n-50)', fg: 'var(--fg-3)', bd: 'var(--border)' },
  deprecated: { bg: '#f6edda', fg: '#8a6314', bd: '#ecdcba' },
  planned:    { bg: 'var(--sky-50)', fg: 'var(--sky)', bd: 'var(--sky-100)' },
};

const CRIT_META: Record<string, { bg: string; fg: string; bd: string }> = {
  high:   { bg: '#f7e7e5', fg: '#a23a2f', bd: '#eccfcb' },
  medium: { bg: '#f6edda', fg: '#8a6314', bd: '#ecdcba' },
  low:    { bg: '#e4f1eb', fg: '#1f6b47', bd: '#b8ddc8' },
};

const REVIEW_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  questionnaire_pending:   { label: 'Questionnaire Ready', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  questionnaire_assigned:  { label: 'Pending Response',    cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
  questionnaire_completed: { label: 'Answers In',          cls: 'bg-purple-100 text-purple-700 border border-purple-200' },
  addressed:               { label: 'Reviewed',            cls: 'bg-green-100 text-green-700 border border-green-200' },
};

const TYPE_ORDER = ['application', 'third-party-service', 'infrastructure', 'cloud-service', 'middleware', 'database'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCost = (amount: number): string => {
  const cr = amount / 10_000_000;
  if (cr >= 1) return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} Cr`;
  const lakh = amount / 100_000;
  if (lakh >= 1) return `₹${lakh.toFixed(0)} L`;
  return `₹${(amount / 1000).toFixed(0)}K`;
};

const pillStyle = (meta: { bg: string; fg: string; bd: string }): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '3px 9px', borderRadius: 999,
  background: meta.bg, color: meta.fg, border: `1px solid ${meta.bd}`,
  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
});

const getTypeIcon = (type: string) => {
  const map: Record<string, React.ComponentType<any>> = {
    application: Globe, database: Database, infrastructure: Server,
    middleware: Settings, 'cloud-service': Cloud, 'third-party-service': Package,
  };
  const Icon = map[type] ?? Package;
  return <Icon style={{ width: 18, height: 18 }} />;
};

// ── Component ─────────────────────────────────────────────────────────────────

const AssetInventory: React.FC = () => {
  const {
    assets, loading, error, deleteAsset,
    searchQuery, setSearchQuery, selectedType, setSelectedType, refreshAssets,
  } = useAssets();
  const { user, canEnrich, canRationalize } = useAuth();
  const { selectedOrg } = useSelectedOrg();

  const orgId: number = (user?.role?.startsWith('admin') && selectedOrg)
    ? selectedOrg.org_id
    : (user?.org_id ?? 0);
  const orgCode: string = (user?.role?.startsWith('admin') && selectedOrg)
    ? selectedOrg.org_code
    : (user?.orgCode ?? '');

  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [viewingAsset, setViewingAsset] = useState<any>(null);
  const [reviewingAsset, setReviewingAsset] = useState<any>(null);
  const [mappingEditAssetId, setMappingEditAssetId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const [reviewMap, setReviewMap] = useState<Map<string, AssetReview>>(new Map());
  const [capabilityMap, setCapabilityMap] = useState<Map<string, string[]>>(new Map());
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioReviewSummary | null>(null);
  const [rationalizationRunning, setRationalizationRunning] = useState(false);
  const [showRationalizationConfirm, setShowRationalizationConfirm] = useState(false);
  // Snapshot of per-type counts (captured when no filter active)
  const [baseTypeCounts, setBaseTypeCounts] = useState<Record<string, number>>({});

  const loadReviewData = useCallback(async () => {
    if (!orgId) return;
    try {
      const [reviews, summary, mappingRows] = await Promise.all([
        AssetReviewService.getReviewsForOrg(orgId),
        getPortfolioReviewSummary(orgId, assets.length),
        isSupabaseConfigured() && supabase
          ? supabase
              .from('asset_capability_mappings')
              .select('asset_id, business_capabilities(name)')
              .eq('org_id', orgId)
          : Promise.resolve({ data: null }),
      ]);

      const map = new Map<string, AssetReview>();
      for (const r of reviews) map.set(r.asset_id, r);
      setReviewMap(map);
      setPortfolioSummary(summary);

      if (mappingRows.data) {
        const capMap = new Map<string, string[]>();
        for (const row of mappingRows.data as any[]) {
          const capName = row.business_capabilities?.name;
          if (!capName) continue;
          const existing = capMap.get(row.asset_id) ?? [];
          existing.push(capName);
          capMap.set(row.asset_id, existing);
        }
        setCapabilityMap(capMap);
      }
    } catch { /* non-fatal */ }
  }, [orgId, assets.length]);

  useEffect(() => { loadReviewData(); }, [loadReviewData]);

  // Snapshot unfiltered type counts when no filters are active
  useEffect(() => {
    if (selectedType === 'all' && !searchQuery) {
      const counts: Record<string, number> = {};
      for (const a of assets) {
        counts[a.type] = (counts[a.type] || 0) + 1;
      }
      setBaseTypeCounts(counts);
    }
  }, [assets, selectedType, searchQuery]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedType]);

  const handleRunRationalization = async () => {
    setRationalizationRunning(true);
    setShowRationalizationConfirm(false);
    try {
      await runRationalization(orgId, orgCode);
    } catch (e) {
      console.error('Rationalization trigger failed:', e);
    } finally {
      setRationalizationRunning(false);
    }
  };

  const handleEdit = (asset: any) => { setEditingAsset(asset); setShowForm(true); };
  const handleDelete = async (assetId: string) => {
    if (window.confirm('Delete this asset?')) {
      try { await deleteAsset(assetId); } catch { /* handled */ }
    }
  };
  const handleFormClose = () => { setShowForm(false); setEditingAsset(null); };

  const totalPages = Math.ceil(assets.length / itemsPerPage);
  const paginatedAssets = assets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ── TYPE FILTER CHIPS ─────────────────────────────────────────────────────
  const totalCount = selectedType === 'all' && !searchQuery ? assets.length : Object.values(baseTypeCounts).reduce((s, n) => s + n, 0);

  const typeChips = [
    { value: 'all', label: 'All Assets', count: totalCount || assets.length },
    ...TYPE_ORDER.map(t => ({
      value: t,
      label: TYPE_META[t]?.label ?? t,
      count: baseTypeCounts[t] ?? 0,
    })).filter(c => c.count > 0),
  ];

  // ── STATUS + CRIT helpers ─────────────────────────────────────────────────
  const getStatusColor = (s: string) => ({
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    deprecated: 'bg-orange-100 text-orange-800',
    planned: 'bg-blue-100 text-blue-800',
  }[s] ?? 'bg-gray-100 text-gray-800');

  const getCriticalityColor = (c: string) => ({
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }[c] ?? 'bg-gray-100 text-gray-800');

  const getAssetIcon = (type: string) => {
    const Icon = ({ application: Globe, database: Database, infrastructure: Server, middleware: Settings, 'cloud-service': Cloud, 'third-party-service': Package } as any)[type] ?? Package;
    return <Icon className="h-5 w-5" />;
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading && assets.length === 0) {
    return (
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: 26, height: 26, color: 'var(--sky)' }} className="animate-spin" />
        <span style={{ marginLeft: 10, font: 'var(--t-small)', color: 'var(--fg-3)' }}>Loading assets…</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 32 }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sky)', margin: '0 0 6px' }}>
          Phase 1 · Know your Landscape
        </p>
        <h1 style={{ font: 'var(--t-h1)', color: 'var(--fg-2)', letterSpacing: '-.02em', margin: 0 }}>Asset Inventory</h1>
        <p style={{ font: 'var(--t-small)', color: 'var(--fg-3)', margin: '6px 0 0' }}>
          Manage your IT assets, upload inventories, and track portfolio status.
        </p>
      </div>

      {/* ── Supabase warning ─────────────────────────────────────────────── */}
      {!isSupabaseConfigured() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">Database Not Connected</h3>
              <p className="text-sm text-amber-700 mt-1">Connect to Supabase to see your database assets.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-800 text-sm flex-1">{error}</span>
          <button onClick={() => refreshAssets()} className="text-red-600 hover:text-red-800">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Asset Review Progress ─────────────────────────────────────────── */}
      {portfolioSummary && portfolioSummary.total > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '18px 22px', boxShadow: 'var(--sh-sm)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
            <span style={{ font: 'var(--t-small)', fontWeight: 700, color: 'var(--fg-2)' }}>Asset Review Progress</span>
            <span style={{ font: 'var(--t-small)', color: 'var(--fg-4)' }}>
              {portfolioSummary.addressed} of {portfolioSummary.total} assets reviewed ({portfolioSummary.readinessPercent}%)
            </span>
            {canRationalize && (
              <button
                onClick={() => setShowRationalizationConfirm(true)}
                disabled={!portfolioSummary.canRunRationalization || rationalizationRunning}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--sky)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', font: 'var(--t-small)', fontWeight: 600, cursor: portfolioSummary.canRunRationalization && !rationalizationRunning ? 'pointer' : 'not-allowed', opacity: (!portfolioSummary.canRunRationalization || rationalizationRunning) ? 0.5 : 1 }}
              >
                <Brain style={{ width: 14, height: 14 }} />
                {rationalizationRunning ? 'Running…' : 'Run Rationalisation'}
              </button>
            )}
          </div>
          <div style={{ height: 9, borderRadius: 999, background: 'var(--ghost)', overflow: 'hidden', display: 'flex' }}>
            {portfolioSummary.addressed > 0 && (
              <div style={{ width: `${(portfolioSummary.addressed / portfolioSummary.total) * 100}%`, background: 'var(--success)' }} />
            )}
            {portfolioSummary.questionnaire > 0 && (
              <div style={{ width: `${(portfolioSummary.questionnaire / portfolioSummary.total) * 100}%`, background: 'var(--warning)' }} />
            )}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, font: 'var(--t-small)', color: 'var(--fg-3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />Reviewed: {portfolioSummary.addressed}
            </span>
            {portfolioSummary.questionnaire > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} />Questionnaire: {portfolioSummary.questionnaire}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--n-300)' }} />Not started: {portfolioSummary.pending}
            </span>
          </div>
        </div>
      )}

      {/* ── Rationalization confirm modal ─────────────────────────────────── */}
      {showRationalizationConfirm && portfolioSummary && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Run Portfolio Rationalisation?</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{portfolioSummary.addressed}</strong> of <strong>{portfolioSummary.total}</strong> assets have completed AI reviews.
            </p>
            {portfolioSummary.pending > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                {portfolioSummary.pending} asset{portfolioSummary.pending > 1 ? 's are' : ' is'} not yet reviewed.
                Rationalisation will run on available data only.
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={handleRunRationalization} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">Run Anyway</button>
              <button onClick={() => setShowRationalizationConfirm(false)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--sky)', border: 'none', borderRadius: 'var(--r-sm)', padding: '10px 16px', font: 'var(--t-small)', fontWeight: 600, color: '#fff', cursor: 'pointer', boxShadow: 'var(--sh-sky)' }}
          >
            <Plus style={{ width: 15, height: 15 }} />Add Asset
          </button>
          <button
            onClick={() => setShowUpload(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', padding: '10px 16px', font: 'var(--t-small)', fontWeight: 600, color: 'var(--fg-2)', cursor: 'pointer' }}
          >
            <Upload style={{ width: 15, height: 15 }} />Upload Spreadsheet
          </button>
          <button
            onClick={() => refreshAssets()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', padding: '10px 16px', font: 'var(--t-small)', fontWeight: 600, color: 'var(--fg-2)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw style={{ width: 15, height: 15 }} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', padding: '9px 14px', font: 'var(--t-small)', color: 'var(--fg-4)', minWidth: 230 }}>
            <Search style={{ width: 15, height: 15, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search assets…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', font: 'var(--t-small)', color: 'var(--fg-2)', width: '100%' }}
            />
          </span>
        </div>
      </div>

      {/* ── Type filter pills ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {typeChips.map(chip => {
          const active = selectedType === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setSelectedType(chip.value)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 999,
                font: 'var(--t-small)', fontWeight: 600,
                background: active ? 'var(--sky)' : '#fff',
                color: active ? '#fff' : 'var(--fg-2)',
                border: active ? '1px solid var(--sky)' : '1px solid var(--border-strong)',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              {chip.label}
              {chip.count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: active ? 'rgba(255,255,255,.25)' : 'var(--n-100)',
                  color: active ? '#fff' : 'var(--fg-3)',
                  borderRadius: 999, padding: '0 6px', lineHeight: '18px',
                }}>
                  {chip.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Asset cards grid ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {paginatedAssets.map(asset => {
          const typeMeta = TYPE_META[asset.type] ?? { color: 'var(--fg-3)', tint: 'var(--n-50)', label: asset.type };
          const disp = (asset.metadata?.time_disposition as string | undefined)?.toLowerCase();
          const dispMeta = disp ? TIME_META[disp] : null;
          const statusMeta = STATUS_META[asset.status] ?? STATUS_META.inactive;
          const critMeta = CRIT_META[asset.criticality] ?? CRIT_META.medium;
          const review = reviewMap.get(asset.id);
          const reviewBadge = review ? REVIEW_STATUS_BADGE[review.review_status] : null;
          const caps = capabilityMap.get(asset.id);

          return (
            <div
              key={asset.id}
              onClick={() => setViewingAsset(asset)}
              className="group"
              style={{
                background: '#fff', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: 18, boxShadow: 'var(--sh-sm)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                transition: 'border-color .15s, transform .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
            >
              {/* Top row: icon + name/type + TIME badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minWidth: 0 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 'var(--r-xs)', background: typeMeta.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: typeMeta.color, flexShrink: 0 }}>
                    {getTypeIcon(asset.type)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: 'var(--t-small)', fontWeight: 700, color: 'var(--fg-2)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.name}>
                      {asset.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-4)', textTransform: 'capitalize' }}>{typeMeta.label}</div>
                    {reviewBadge && (
                      <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${reviewBadge.cls}`}>
                        {reviewBadge.label}
                        {review?.review_status === 'addressed' && review.completeness_score != null
                          ? ` ${review.completeness_score.toFixed(0)}%` : ''}
                      </span>
                    )}
                  </div>
                </div>
                {dispMeta && (
                  <span style={{ ...pillStyle(dispMeta), fontSize: 11, flexShrink: 0, textTransform: 'capitalize' }}>
                    {disp!.charAt(0).toUpperCase() + disp!.slice(1)}
                  </span>
                )}
              </div>

              {/* Description */}
              <p style={{ fontSize: 12.5, color: 'var(--fg-3)', margin: '0 0 14px', lineHeight: 1.5, minHeight: 38, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {asset.description}
              </p>

              {/* Status + criticality + cost */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 13 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={pillStyle(statusMeta)}>{asset.status}</span>
                  <span style={pillStyle(critMeta)}>{asset.criticality}</span>
                </div>
                {asset.annual_cost ? (
                  <span style={{ fontSize: 12, color: 'var(--fg-4)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {formatCost(asset.annual_cost)}/yr
                  </span>
                ) : null}
              </div>

              {/* Capabilities (if mapped) */}
              {caps && caps.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }} onClick={e => e.stopPropagation()}>
                  {caps.slice(0, 2).map((c, i) => (
                    <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5 truncate max-w-[120px]" title={c}>{c}</span>
                  ))}
                  {caps.length > 2 && <span className="text-xs text-gray-400">+{caps.length - 2}</span>}
                </div>
              )}

              {/* Owner row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--ghost)', paddingTop: 11, marginTop: 'auto' }}>
                <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>Owner</span>
                <span style={{ fontSize: 12, color: 'var(--fg-2)', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                  {asset.owner || '—'}
                </span>
              </div>

              {/* Admin action buttons (visible on hover) */}
              {canEnrich && (
                <div
                  className="opacity-0 group-hover:opacity-100"
                  style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 8, transition: 'opacity .15s' }}
                  onClick={e => e.stopPropagation()}
                >
                  <button onClick={() => setReviewingAsset(asset)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', borderRadius: 4 }} title="AI Review"><Brain style={{ width: 14, height: 14 }} /></button>
                  <button onClick={() => setMappingEditAssetId(asset.id)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', borderRadius: 4 }} title="Edit capabilities"><Pencil style={{ width: 14, height: 14 }} /></button>
                  <button onClick={() => handleEdit(asset)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', borderRadius: 4 }} title="Edit asset"><Edit style={{ width: 14, height: 14 }} /></button>
                  <button onClick={() => handleDelete(asset.id)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rag-red)', borderRadius: 4 }} title="Delete asset"><Trash2 style={{ width: 14, height: 14 }} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {assets.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <Database style={{ width: 44, height: 44, color: 'var(--fg-4)', margin: '0 auto 12px' }} />
          <h3 style={{ font: 'var(--t-h4)', color: 'var(--fg-2)', margin: '0 0 6px' }}>No assets found</h3>
          <p style={{ font: 'var(--t-small)', color: 'var(--fg-3)' }}>
            {searchQuery || selectedType !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first asset or uploading a spreadsheet'}
          </p>
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {assets.length > 0 && totalPages > 1 && (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ font: 'var(--t-small)', color: 'var(--fg-4)' }}>
            Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, assets.length)} of {assets.length} assets
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '6px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', background: '#fff', font: 'var(--t-small)', color: 'var(--fg-2)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
            >Previous</button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '6px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', background: '#fff', font: 'var(--t-small)', color: 'var(--fg-2)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
            >Next</button>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showForm && <AssetForm asset={editingAsset} onClose={handleFormClose} />}
      {showUpload && <AssetUpload onClose={() => setShowUpload(false)} />}
      {reviewingAsset && (
        <AssetReviewPanel
          asset={reviewingAsset}
          onClose={() => { setReviewingAsset(null); loadReviewData(); }}
        />
      )}
      {mappingEditAssetId && user?.id && (
        <ManualMappingModal
          orgId={orgId}
          userId={user.id}
          initialAssetId={mappingEditAssetId}
          onClose={() => { setMappingEditAssetId(null); loadReviewData(); }}
        />
      )}

      {/* ── Asset detail drawer ───────────────────────────────────────────── */}
      {viewingAsset && (() => {
        const a = viewingAsset;
        const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
        const isEol = a.end_of_life_date && new Date(a.end_of_life_date) < new Date();
        const isEos = a.end_of_support_date && new Date(a.end_of_support_date) < new Date();
        const Field = ({ label, value }: { label: string; value?: React.ReactNode }) =>
          value ? (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <div className="text-sm text-gray-900">{value}</div>
            </div>
          ) : null;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={() => setViewingAsset(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(13,17,23,.4)', backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'relative', width: 480, maxWidth: '92vw', height: '100%', background: '#fff', boxShadow: 'var(--sh-lg)', overflowY: 'auto' }} className="sit-scroll">
              {/* Drawer header */}
              <div style={{ position: 'sticky', top: 0, background: 'var(--ink)', color: '#fff', padding: '22px 24px', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: TYPE_META[a.type]?.color ?? 'var(--fg-4)' }} />
                      <span style={{ font: 'var(--t-small)', color: 'var(--fgd-3)', textTransform: 'capitalize' }}>
                        {TYPE_META[a.type]?.label ?? a.type} · {a.category}
                      </span>
                    </div>
                    <h2 style={{ font: 'var(--t-h3)', color: '#fff', margin: 0 }}>{a.name}</h2>
                    {a.asset_tag && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--ink-2)', color: 'var(--fgd-3)', padding: '2px 6px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>{a.asset_tag}</span>}
                  </div>
                  <button
                    onClick={() => setViewingAsset(null)}
                    style={{ background: 'var(--ink-2)', border: '1px solid var(--border-dark)', borderRadius: 'var(--r-sm)', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <span style={pillStyle({ bg: CRIT_META[a.criticality]?.bg ?? '#f6edda', fg: CRIT_META[a.criticality]?.fg ?? '#8a6314', bd: CRIT_META[a.criticality]?.bd ?? '#ecdcba' })}>
                    {a.criticality} criticality
                  </span>
                  <span style={pillStyle({ bg: STATUS_META[a.status]?.bg ?? 'var(--n-50)', fg: STATUS_META[a.status]?.fg ?? 'var(--fg-3)', bd: STATUS_META[a.status]?.bd ?? 'var(--border)' })}>
                    {a.status}
                  </span>
                  {a.metadata?.time_disposition && (() => {
                    const d = (a.metadata.time_disposition as string).toLowerCase();
                    const m = TIME_META[d];
                    return m ? <span style={pillStyle(m)}>{d.charAt(0).toUpperCase() + d.slice(1)}</span> : null;
                  })()}
                </div>
              </div>

              {/* Drawer body */}
              <div className="p-6 space-y-6">
                {a.description && <p className="text-sm text-gray-700 leading-relaxed">{a.description}</p>}

                {(() => {
                  const caps = capabilityMap.get(a.id);
                  if (!caps?.length) return null;
                  return (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Business Capabilities Served</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {caps.map((c, i) => <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-1">{c}</span>)}
                      </div>
                    </div>
                  );
                })()}

                {(isEol || isEos) && (
                  <div className="flex gap-3 flex-wrap">
                    {isEol && <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs font-medium text-red-700">⚠ End-of-Life reached {fmt(a.end_of_life_date)}</div>}
                    {isEos && <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-medium text-amber-700">⚠ End-of-Support reached {fmt(a.end_of_support_date)}</div>}
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Vendor &amp; Sourcing</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Vendor" value={a.vendor} />
                    <Field label="Sourcing Type" value={a.sourcing_type?.replace('_', ' ')} />
                    <Field label="Category" value={a.category} />
                    <Field label="Business Unit" value={a.business_unit} />
                    <Field label="Owner" value={a.owner} />
                    <Field label="Location" value={a.location ?? a.hostname} />
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Lifecycle</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Purchase Date" value={fmt(a.purchase_date)} />
                    <Field label="Last Reviewed" value={fmt(a.last_reviewed_date)} />
                    <Field label="End of Life" value={a.end_of_life_date ? <span className={isEol ? 'text-red-600 font-semibold' : ''}>{fmt(a.end_of_life_date)}</span> : null} />
                    <Field label="End of Support" value={a.end_of_support_date ? <span className={isEos ? 'text-amber-600 font-semibold' : ''}>{fmt(a.end_of_support_date)}</span> : null} />
                    <Field label="License Expiry" value={fmt(a.license_expiry_date)} />
                    <Field label="License Type" value={a.license_type} />
                  </div>
                </div>

                {a.annual_cost && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Financial</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <Field label="Annual Cost" value={formatCost(a.annual_cost)} />
                      <Field label="Support Contract" value={a.support_contract_id} />
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Compliance &amp; Risk</h3>
                  <div className="space-y-3">
                    {a.data_classification && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Data Classification</p>
                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          a.data_classification === 'restricted' ? 'bg-red-50 text-red-700 border-red-200' :
                          a.data_classification === 'confidential' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          a.data_classification === 'internal' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>{a.data_classification}</span>
                      </div>
                    )}
                    {a.compliance_tags?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Compliance Frameworks</p>
                        <div className="flex flex-wrap gap-1.5">
                          {a.compliance_tags.map((t: string) => <span key={t} className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full">{t}</span>)}
                        </div>
                      </div>
                    )}
                    {a.criticality_justification && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Criticality Justification</p>
                        <p className="text-sm text-gray-700">{a.criticality_justification}</p>
                      </div>
                    )}
                  </div>
                </div>

                {a.metadata && Object.keys(a.metadata).length > 0 && (() => {
                  const { additional_specs, relationships, ...topSpecs } = a.metadata as Record<string, any>;
                  const isScalar = (v: any) => v !== null && v !== undefined && v !== '' && typeof v !== 'object';
                  const topEntries  = Object.entries(topSpecs).filter(([, v]) => isScalar(v));
                  const addlEntries = additional_specs ? Object.entries(additional_specs as Record<string, any>).filter(([, v]) => isScalar(v)) : [];
                  const relEntries  = relationships ? Object.entries(relationships as Record<string, string>).filter(([, v]) => v) : [];
                  if (topEntries.length === 0 && addlEntries.length === 0 && relEntries.length === 0) return null;
                  const SpecGrid = ({ entries }: { entries: [string, any][] }) => (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {entries.map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</p>
                          <div className="text-sm text-gray-900 break-all">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  );
                  return (
                    <div className="space-y-4">
                      {topEntries.length > 0 && <div><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Technical Specs</h3><SpecGrid entries={topEntries} /></div>}
                      {addlEntries.length > 0 && <div><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{topEntries.length > 0 ? 'Additional Specs' : 'Technical Specs'}</h3><SpecGrid entries={addlEntries} /></div>}
                      {relEntries.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Dependencies</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {relEntries.map(([key, value]) => (
                              <div key={key} className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase w-24 flex-shrink-0 pt-0.5">{key.replace(/_/g, ' ')}</span>
                                <span className="text-sm text-gray-800">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {a.tags?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {a.tags.map((tag: string, i: number) => <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{tag}</span>)}
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                  <span>Created by: {a.createdBy}</span>
                  <span>Last updated: {a.lastUpdated ? new Date(a.lastUpdated).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AssetInventory;
