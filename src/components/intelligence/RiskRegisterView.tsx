import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, Shield, CheckCircle, Plus, RefreshCw, Flag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOrg } from '../../contexts/SelectedOrgContext';
import { getOrCreateEngagement, Engagement } from '../../services/engagementService';
import {
  getRisks, getRAIDItems, autoPopulateRisks, createRAIDItem, updateRisk, updateRAIDItem,
  getPhaseGateStatus, RiskRegisterItem, RAIDItem,
} from '../../services/riskRegisterService';

const SKY = '#1a6fb5';
const INK = '#0d1117';
const GHOST2 = '#f4f6f9';

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', bg: '#f7e7e5', text: '#a23a2f' },
  high:     { label: 'High',     bg: '#fdf1e5', text: '#8a4800' },
  medium:   { label: 'Medium',   bg: '#f6edda', text: '#8a6314' },
  low:      { label: 'Low',      bg: '#e7f0f9', text: '#175a93' },
};

const STATUS_CONFIG = {
  open:       { label: 'Open',       bg: '#f7e7e5', text: '#a23a2f' },
  mitigating: { label: 'Mitigating', bg: '#f6edda', text: '#8a6314' },
  'in-progress':{ label: 'In Progress', bg: '#f6edda', text: '#8a6314' },
  resolved:   { label: 'Resolved',   bg: '#e7f9ef', text: '#1a6b40' },
  accepted:   { label: 'Accepted',   bg: '#e7f0f9', text: '#175a93' },
  invalidated:{ label: 'Invalidated',bg: '#f4f6f9', text: '#6b7a8d' },
};

const RAID_TYPE_CONFIG = {
  risk:       { label: 'Risk',       bg: '#f7e7e5', text: '#a23a2f', code: 'R' },
  assumption: { label: 'Assumption', bg: '#e7f0f9', text: '#175a93', code: 'A' },
  issue:      { label: 'Issue',      bg: '#f6edda', text: '#8a6314', code: 'I' },
  dependency: { label: 'Dependency', bg: '#ecebf6', text: '#403592', code: 'D' },
};

type ActiveTab = 'risks' | 'raid';
type RAIDTypeFilter = 'all' | RAIDItem['raid_type'];

interface NewRAIDForm {
  raid_type: RAIDItem['raid_type'];
  title: string;
  description: string;
  severity: RiskRegisterItem['severity'];
  phase_gate_item: boolean;
}

const EMPTY_FORM: NewRAIDForm = {
  raid_type: 'risk', title: '', description: '', severity: 'medium', phase_gate_item: false,
};

const RiskRegisterView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { selectedOrg } = useSelectedOrg();
  const orgId: number | undefined = isAdmin ? selectedOrg?.org_id : (user as any)?.org_id;

  const [engagement, setEngagement]       = useState<Engagement | null>(null);
  const [risks, setRisks]                 = useState<RiskRegisterItem[]>([]);
  const [raidItems, setRaidItems]         = useState<RAIDItem[]>([]);
  const [phaseGate, setPhaseGate]         = useState<{ total: number; open: number; canAdvance: boolean } | null>(null);
  const [activeTab, setActiveTab]         = useState<ActiveTab>('risks');
  const [raidFilter, setRaidFilter]       = useState<RAIDTypeFilter>('all');
  const [loading, setLoading]             = useState(true);
  const [populating, setPopulating]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [showNewForm, setShowNewForm]     = useState(false);
  const [newForm, setNewForm]             = useState<NewRAIDForm>(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);

  const loadData = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const eng = await getOrCreateEngagement(orgId);
      setEngagement(eng);
      if (!eng) { setLoading(false); return; }
      const [r, raid, pg] = await Promise.all([
        getRisks(eng.id),
        getRAIDItems(eng.id),
        getPhaseGateStatus(eng.id),
      ]);
      setRisks(r);
      setRaidItems(raid);
      setPhaseGate(pg);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load risk data.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAutoPopulate = async () => {
    if (!orgId || !engagement) return;
    setPopulating(true);
    try {
      await autoPopulateRisks(orgId, engagement.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPopulating(false);
    }
  };

  const handleCreateRAID = async () => {
    if (!orgId || !engagement || !newForm.title.trim()) return;
    setSaving(true);
    try {
      await createRAIDItem({
        org_id: orgId,
        engagement_id: engagement.id,
        raid_type: newForm.raid_type,
        severity: newForm.severity,
        probability: null, impact: null,
        title: newForm.title,
        description: newForm.description || null,
        related_asset_ids: [], related_capability_ids: [], related_risk_ids: [],
        raised_by: null, owner: null, due_date: null,
        response_plan: null, contingency: null,
        status: 'open', resolution_notes: null, resolved_at: null,
        phase_gate_item: newForm.phase_gate_item,
      });
      setShowNewForm(false);
      setNewForm(EMPTY_FORM);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRiskStatusChange = async (id: string, status: RiskRegisterItem['status']) => {
    try { await updateRisk(id, { status }); await loadData(); }
    catch (e: any) { setError(e.message); }
  };

  const handleRAIDStatusChange = async (id: string, status: RAIDItem['status']) => {
    try { await updateRAIDItem(id, { status }); await loadData(); }
    catch (e: any) { setError(e.message); }
  };

  const filteredRAID = raidFilter === 'all' ? raidItems : raidItems.filter(r => r.raid_type === raidFilter);
  const openRisks = risks.filter(r => r.status === 'open' || r.status === 'mitigating').length;
  const criticalRisks = risks.filter(r => r.severity === 'critical').length;

  if (!orgId) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <p style={{ color: 'var(--fg-3)' }}>{isAdmin ? 'Select an organisation.' : 'No organisation context.'}</p>
      </div>
    );
  }

  return (
    <div style={{ background: GHOST2, minHeight: '100%', padding: '28px 32px' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p style={{ font: 'var(--t-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', color: SKY, marginBottom: 4 }}>
            Portfolio Intelligence
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: INK, margin: 0 }}>
            Risk Register
          </h1>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoPopulate} disabled={populating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#fff', color: SKY, border: `1px solid ${SKY}`, cursor: populating ? 'not-allowed' : 'pointer' }}
            >
              {populating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Auto-populate Risks
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: SKY, color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={14} /> New RAID Item
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: '#f7e7e5', color: '#a23a2f', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Phase gate banner */}
      {phaseGate && phaseGate.total > 0 && (
        <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: phaseGate.canAdvance ? '#e7f9ef' : '#f7e7e5', border: `1px solid ${phaseGate.canAdvance ? '#2f8f6b' : '#c0473a'}` }}>
          {phaseGate.canAdvance
            ? <CheckCircle size={18} style={{ color: '#2f8f6b', flexShrink: 0 }} />
            : <AlertTriangle size={18} style={{ color: '#c0473a', flexShrink: 0 }} />}
          <p style={{ fontSize: 13, margin: 0, color: phaseGate.canAdvance ? '#1a6b40' : '#a23a2f', fontWeight: 500 }}>
            {phaseGate.canAdvance
              ? `All ${phaseGate.total} phase-gate items resolved — ready to advance.`
              : `${phaseGate.open} of ${phaseGate.total} phase-gate items still open — resolve before advancing.`}
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Risks',     value: risks.length,    color: INK,      icon: <Shield size={18} /> },
          { label: 'Critical',        value: criticalRisks,   color: '#c0473a',icon: <AlertTriangle size={18} /> },
          { label: 'Open / Active',   value: openRisks,       color: '#b07d1a',icon: <Flag size={18} /> },
          { label: 'RAID Items',      value: raidItems.length,color: SKY,      icon: <CheckCircle size={18} /> },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: 0 }}>
                {card.label}
              </p>
              <span style={{ color: card.color }}>{card.icon}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: card.color, margin: 0, lineHeight: 1 }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* New RAID item form */}
      {showNewForm && isAdmin && (
        <div className="mb-5 rounded-xl p-5" style={{ background: '#fff', boxShadow: 'var(--sh-md)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: INK, marginBottom: 16 }}>
            New RAID Item
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={newForm.raid_type} onChange={e => setNewForm(f => ({ ...f, raid_type: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                {(['risk', 'assumption', 'issue', 'dependency'] as const).map(t => (
                  <option key={t} value={t}>{RAID_TYPE_CONFIG[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Severity</label>
              <select value={newForm.severity} onChange={e => setNewForm(f => ({ ...f, severity: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                {(['critical', 'high', 'medium', 'low'] as const).map(s => (
                  <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Title *</label>
            <input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief title for this item…"
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', outline: 'none' }} />
          </div>
          <div className="mb-4">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Optional detail…"
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', resize: 'vertical', outline: 'none' }} />
          </div>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={newForm.phase_gate_item} onChange={e => setNewForm(f => ({ ...f, phase_gate_item: e.target.checked }))} />
            <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>Phase gate item (must resolve before advancing)</span>
          </label>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateRAID} disabled={saving || !newForm.title.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: saving || !newForm.title.trim() ? '#aab4c0' : SKY, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Add Item'}
            </button>
            <button onClick={() => { setShowNewForm(false); setNewForm(EMPTY_FORM); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#f4f6f9', color: 'var(--fg-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        {([['risks', 'Risk Register'], ['raid', 'RAID Log']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="px-4 py-2.5 text-sm font-semibold transition-all"
            style={{ color: activeTab === id ? SKY : 'var(--fg-3)', borderBottom: `2px solid ${activeTab === id ? SKY : 'transparent'}`, background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', cursor: 'pointer', marginBottom: -1 }}>
            {label}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: activeTab === id ? '#e7f0f9' : '#f4f6f9', color: activeTab === id ? SKY : 'var(--fg-3)' }}>
              {id === 'risks' ? risks.length : raidItems.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: SKY }} />
        </div>
      ) : activeTab === 'risks' ? (
        risks.length === 0 ? (
          <div className="rounded-2xl flex flex-col items-center justify-center py-14 text-center"
            style={{ background: '#fff', border: '2px dashed var(--border)' }}>
            <Shield size={40} style={{ color: SKY, marginBottom: 12 }} />
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: INK, marginBottom: 8 }}>No risks identified yet</p>
            <p style={{ color: 'var(--fg-3)', fontSize: 13, marginBottom: 16 }}>
              Run auto-populate to generate risks from published asset scores and capability gaps.
            </p>
            {isAdmin && (
              <button onClick={handleAutoPopulate} disabled={populating}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: SKY, color: '#fff', border: 'none', cursor: 'pointer' }}>
                {populating ? 'Populating…' : 'Auto-populate Risks'}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-sunk)' }}>
                  {['Severity', 'Risk Type', 'Title', 'Source', 'Status', ...(isAdmin ? ['Action'] : [])].map(h => (
                    <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risks.map((r, i) => {
                  const sevCfg = SEVERITY_CONFIG[r.severity];
                  const stCfg = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
                  return (
                    <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: sevCfg.bg, color: sevCfg.text }}>{sevCfg.label}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--fg-3)', fontSize: 12 }}>
                        {r.risk_type.replace(/-/g, ' ')}
                      </td>
                      <td className="px-4 py-3" style={{ fontWeight: 500, color: INK, maxWidth: 300 }}>
                        <span className="block truncate">{r.title}</span>
                        {r.mitigation_hint && (
                          <span className="block text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>{r.mitigation_hint}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: r.source === 'auto' ? '#e7f0f9' : '#e7f9ef', color: r.source === 'auto' ? '#175a93' : '#1a6b40' }}>
                          {r.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <select value={r.status} onChange={e => handleRiskStatusChange(r.id, e.target.value as any)}
                            className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                            {(['open', 'mitigating', 'resolved', 'accepted'] as const).map(s => (
                              <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                            ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* RAID Log tab */
        <>
          <div className="flex items-center gap-2 mb-4">
            {(['all', 'risk', 'assumption', 'issue', 'dependency'] as const).map(f => {
              const cfg = f === 'all' ? null : RAID_TYPE_CONFIG[f];
              return (
                <button key={f} onClick={() => setRaidFilter(f)}
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: raidFilter === f ? (f === 'all' ? SKY : cfg!.bg) : 'transparent',
                    color: raidFilter === f ? (f === 'all' ? '#fff' : cfg!.text) : 'var(--fg-3)',
                    border: `1px solid ${raidFilter === f ? (f === 'all' ? SKY : cfg!.text) : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}>
                  {f === 'all' ? 'All' : cfg!.label}
                </button>
              );
            })}
          </div>

          {filteredRAID.length === 0 ? (
            <div className="rounded-2xl flex flex-col items-center justify-center py-14 text-center"
              style={{ background: '#fff', border: '2px dashed var(--border)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: INK, marginBottom: 8 }}>
                No RAID items yet
              </p>
              <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>
                Add risks, assumptions, issues, and dependencies using the New RAID Item button above.
              </p>
            </div>
          ) : (
            <div className="rounded-xl" style={{ background: '#fff', boxShadow: 'var(--sh-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-sunk)' }}>
                    {['Ref', 'Type', 'Title', 'Severity', 'Gate', 'Status', ...(isAdmin ? ['Action'] : [])].map(h => (
                      <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRAID.map((item, i) => {
                    const typeCfg = RAID_TYPE_CONFIG[item.raid_type];
                    const stCfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
                    const sevCfg = item.severity ? SEVERITY_CONFIG[item.severity] : null;
                    return (
                      <tr key={item.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-4 py-3">
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: SKY, fontWeight: 600 }}>
                            {item.ref_code ?? `${typeCfg.code}-???`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: typeCfg.bg, color: typeCfg.text }}>{typeCfg.label}</span>
                        </td>
                        <td className="px-4 py-3" style={{ fontWeight: 500, color: INK, maxWidth: 280 }}>
                          <span className="block truncate">{item.title}</span>
                        </td>
                        <td className="px-4 py-3">
                          {sevCfg ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: sevCfg.bg, color: sevCfg.text }}>{sevCfg.label}</span>
                          ) : <span style={{ color: '#aab4c0' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {item.phase_gate_item
                            ? <Flag size={14} style={{ color: '#c0473a' }} title="Phase gate item" />
                            : <span style={{ color: '#aab4c0' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <select value={item.status} onChange={e => handleRAIDStatusChange(item.id, e.target.value as any)}
                              className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                              {(['open', 'in-progress', 'resolved', 'accepted', 'invalidated'] as const).map(s => (
                                <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                              ))}
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RiskRegisterView;
