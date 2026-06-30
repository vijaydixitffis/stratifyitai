import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, GitBranch, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOrg } from '../../contexts/SelectedOrgContext';
import { getOrCreateEngagement, Engagement } from '../../services/engagementService';
import {
  getInitiatives, createInitiative, updateInitiative,
  RoadmapInitiative, InitiativeType, InitiativeHorizon, InitiativeEffort, InitiativeCostBand,
  INITIATIVE_TYPE_LABELS, INITIATIVE_TYPE_COLORS,
} from '../../services/roadmapInitiativeService';

const SKY = '#1a6fb5';
const INK = '#0d1117';
const GHOST2 = '#f4f6f9';

const HORIZON_CONFIG: Record<InitiativeHorizon, { label: string; subtitle: string; bg: string; border: string }> = {
  'short-term': { label: 'Immediate',  subtitle: '< 6 months',  bg: '#fff',     border: '#c0473a' },
  'mid-term':   { label: 'Near-term',  subtitle: '6–12 months', bg: '#fff',     border: '#b07d1a' },
  'long-term':  { label: 'Strategic',  subtitle: '12–24 months',bg: '#fff',     border: SKY },
};

const EFFORT_LABELS: Record<InitiativeEffort, string> = { S: 'Small', M: 'Medium', L: 'Large', XL: 'XL' };
const COST_COLORS: Record<InitiativeCostBand, string> = { low: '#2f8f6b', medium: '#b07d1a', high: '#c0473a' };
const STATUS_CONFIG = {
  proposed:  { label: 'Proposed',  bg: '#f4f6f9', text: '#4d5c6e' },
  'in-flight':{ label: 'In Flight', bg: '#e7f0f9', text: '#175a93' },
  complete:  { label: 'Complete',  bg: '#e7f9ef', text: '#1a6b40' },
  deferred:  { label: 'Deferred',  bg: '#f6edda', text: '#8a6314' },
  cancelled: { label: 'Cancelled', bg: '#f7e7e5', text: '#a23a2f' },
};

interface NewInitiativeForm {
  title: string;
  initiative_type: InitiativeType;
  horizon: InitiativeHorizon;
  description: string;
  effort: InitiativeEffort;
  cost_band: InitiativeCostBand;
  business_value_score: string;
  risk_if_delayed: 'low' | 'medium' | 'high';
  workstream: string;
}

const EMPTY_FORM: NewInitiativeForm = {
  title: '', initiative_type: 'modernization', horizon: 'short-term',
  description: '', effort: 'M', cost_band: 'medium',
  business_value_score: '3', risk_if_delayed: 'medium', workstream: '',
};

const InitiativeCard: React.FC<{
  initiative: RoadmapInitiative;
  isAdmin: boolean;
  onStatusChange: (id: string, status: RoadmapInitiative['status']) => void;
}> = ({ initiative, isAdmin, onStatusChange }) => {
  const typeCfg = INITIATIVE_TYPE_COLORS[initiative.initiative_type];
  const stCfg = STATUS_CONFIG[initiative.status] ?? STATUS_CONFIG.proposed;

  return (
    <div className="rounded-xl p-4 mb-3"
      style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
          style={{ background: typeCfg.bg, color: typeCfg.text }}>
          {INITIATIVE_TYPE_LABELS[initiative.initiative_type]}
        </span>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: stCfg.bg, color: stCfg.text }}>
          {stCfg.label}
        </span>
      </div>
      <p style={{ fontWeight: 600, color: INK, fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>
        {initiative.title}
      </p>
      {initiative.description && (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 8, lineHeight: 1.5 }}>
          {initiative.description.length > 100 ? `${initiative.description.slice(0, 100)}…` : initiative.description}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {initiative.effort && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#f4f6f9', color: '#4d5c6e' }}>
            {EFFORT_LABELS[initiative.effort]}
          </span>
        )}
        {initiative.cost_band && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${COST_COLORS[initiative.cost_band]}18`, color: COST_COLORS[initiative.cost_band] }}>
            {initiative.cost_band} cost
          </span>
        )}
        {initiative.business_value_score && (
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            BV: {initiative.business_value_score}/5
          </span>
        )}
        {initiative.linked_asset_ids.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            {initiative.linked_asset_ids.length} asset{initiative.linked_asset_ids.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {isAdmin && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <select value={initiative.status}
            onChange={e => onStatusChange(initiative.id, e.target.value as RoadmapInitiative['status'])}
            className="text-xs px-2 py-1 rounded w-full"
            style={{ border: '1px solid var(--border)', background: '#fafafa', cursor: 'pointer' }}>
            {(Object.keys(STATUS_CONFIG) as RoadmapInitiative['status'][]).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

const RoadmapKanban: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { selectedOrg } = useSelectedOrg();
  const orgId: number | undefined = isAdmin ? selectedOrg?.org_id : (user as any)?.org_id;

  const [engagement, setEngagement]   = useState<Engagement | null>(null);
  const [initiatives, setInitiatives] = useState<RoadmapInitiative[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState<NewInitiativeForm>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [typeFilter, setTypeFilter]   = useState<InitiativeType | 'all'>('all');

  const loadData = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const eng = await getOrCreateEngagement(orgId);
      setEngagement(eng);
      if (eng) {
        const items = await getInitiatives(eng.id);
        setInitiatives(items);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load roadmap.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!orgId || !engagement || !form.title.trim()) return;
    setSaving(true);
    try {
      await createInitiative({
        org_id:                orgId,
        engagement_id:         engagement.id,
        initiative_type:       form.initiative_type,
        horizon:               form.horizon,
        title:                 form.title,
        description:           form.description || null,
        effort:                form.effort,
        cost_band:             form.cost_band,
        business_value_score:  parseInt(form.business_value_score, 10) || null,
        risk_if_delayed:       form.risk_if_delayed,
        linked_asset_ids:      [],
        linked_capability_ids: [],
        linked_risk_ids:       [],
        milestone_number:      null,
        workstream:            form.workstream || null,
        status:                'proposed',
        sort_order:            null,
        created_by:            null,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: RoadmapInitiative['status']) => {
    try { await updateInitiative(id, { status }); await loadData(); }
    catch (e: any) { setError(e.message); }
  };

  const filtered = typeFilter === 'all' ? initiatives : initiatives.filter(i => i.initiative_type === typeFilter);
  const byHorizon = (h: InitiativeHorizon) => filtered.filter(i => i.horizon === h);

  if (!orgId) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <p style={{ color: 'var(--fg-3)' }}>{isAdmin ? 'Select an organisation.' : 'No organisation context.'}</p>
      </div>
    );
  }

  return (
    <div style={{ background: GHOST2, minHeight: '100%', padding: '28px 32px' }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', color: SKY, marginBottom: 4 }}>
            The Way Forward
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: INK, margin: 0 }}>
            Transformation Roadmap
          </h1>
          <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 4 }}>
            {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''} across {Object.keys(HORIZON_CONFIG).length} horizons
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: SKY, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: 'var(--sh-sky)' }}>
            <Plus size={14} /> New Initiative
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: '#f7e7e5', color: '#a23a2f', fontSize: 14 }}>{error}</div>
      )}

      {/* Type filter chips */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button onClick={() => setTypeFilter('all')}
          className="px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: typeFilter === 'all' ? SKY : '#fff', color: typeFilter === 'all' ? '#fff' : 'var(--fg-3)', border: `1px solid ${typeFilter === 'all' ? SKY : 'var(--border)'}`, cursor: 'pointer' }}>
          All Types
        </button>
        {(Object.keys(INITIATIVE_TYPE_LABELS) as InitiativeType[]).map(t => {
          const cfg = INITIATIVE_TYPE_COLORS[t];
          return (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: typeFilter === t ? cfg.bg : '#fff',
                color: typeFilter === t ? cfg.text : 'var(--fg-3)',
                border: `1px solid ${typeFilter === t ? cfg.text : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
              {INITIATIVE_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* New initiative form */}
      {showForm && isAdmin && (
        <div className="mb-6 rounded-xl p-5" style={{ background: '#fff', boxShadow: 'var(--sh-md)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: INK, margin: 0 }}>
              New Initiative
            </h3>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)' }}>
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Initiative title…"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={form.initiative_type} onChange={e => setForm(f => ({ ...f, initiative_type: e.target.value as InitiativeType }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                {(Object.keys(INITIATIVE_TYPE_LABELS) as InitiativeType[]).map(t => (
                  <option key={t} value={t}>{INITIATIVE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Horizon</label>
              <select value={form.horizon} onChange={e => setForm(f => ({ ...f, horizon: e.target.value as InitiativeHorizon }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                {(Object.keys(HORIZON_CONFIG) as InitiativeHorizon[]).map(h => (
                  <option key={h} value={h}>{HORIZON_CONFIG[h].label} ({HORIZON_CONFIG[h].subtitle})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Effort</label>
              <select value={form.effort} onChange={e => setForm(f => ({ ...f, effort: e.target.value as InitiativeEffort }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                {(Object.keys(EFFORT_LABELS) as InitiativeEffort[]).map(e => (
                  <option key={e} value={e}>{EFFORT_LABELS[e]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Cost Band</label>
              <select value={form.cost_band} onChange={e => setForm(f => ({ ...f, cost_band: e.target.value as InitiativeCostBand }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                {(['low', 'medium', 'high'] as InitiativeCostBand[]).map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Business Value (1–5)</label>
              <input type="number" min={1} max={5} value={form.business_value_score}
                onChange={e => setForm(f => ({ ...f, business_value_score: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Risk if Delayed</label>
              <select value={form.risk_if_delayed} onChange={e => setForm(f => ({ ...f, risk_if_delayed: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                {['low', 'medium', 'high'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Workstream</label>
              <input value={form.workstream} onChange={e => setForm(f => ({ ...f, workstream: e.target.value }))}
                placeholder="e.g. Cloud Migration…"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div className="col-span-2">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="Optional detail…"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', resize: 'vertical', outline: 'none' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.title.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: saving || !form.title.trim() ? '#aab4c0' : SKY, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Add Initiative'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#f4f6f9', color: 'var(--fg-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: SKY }} />
        </div>
      ) : initiatives.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center justify-center py-16 text-center"
          style={{ background: '#fff', border: '2px dashed var(--border)' }}>
          <GitBranch size={40} style={{ color: SKY, marginBottom: 12 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: INK, marginBottom: 8 }}>
            No initiatives yet
          </p>
          <p style={{ color: 'var(--fg-3)', fontSize: 13, maxWidth: 400, marginBottom: 20 }}>
            Add transformation initiatives and assign them to horizons to build your roadmap.
          </p>
          {isAdmin && (
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: SKY, color: '#fff', border: 'none', cursor: 'pointer' }}>
              Add First Initiative
            </button>
          )}
        </div>
      ) : (
        /* 3-column Kanban */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(HORIZON_CONFIG) as InitiativeHorizon[]).map(horizon => {
            const hCfg = HORIZON_CONFIG[horizon];
            const cards = byHorizon(horizon);
            return (
              <div key={horizon} className="rounded-xl" style={{ background: '#f4f6f9', border: `1px solid var(--border)`, minHeight: 400 }}>
                {/* Column header */}
                <div className="px-4 py-3 rounded-t-xl flex items-center gap-2"
                  style={{ background: hCfg.bg, borderBottom: `3px solid ${hCfg.border}` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: hCfg.border, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: INK, margin: 0 }}>
                      {hCfg.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>{hCfg.subtitle}</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${hCfg.border}18`, color: hCfg.border }}>
                    {cards.length}
                  </span>
                </div>
                <div className="p-3">
                  {cards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>No initiatives in this horizon</p>
                    </div>
                  ) : (
                    cards.map(initiative => (
                      <InitiativeCard
                        key={initiative.id}
                        initiative={initiative}
                        isAdmin={isAdmin}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RoadmapKanban;
