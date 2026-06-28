import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOrg } from '../../contexts/SelectedOrgContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Save, Loader2,
  AlertCircle, CheckCircle, Star,
} from 'lucide-react';

interface Capability {
  id: string;
  name: string;
  description: string;
  level: number;
  parent_id: string | null;
  is_ai_priority: boolean;
  strategic_importance: 'critical' | 'high' | 'medium' | 'low';
  sort_order: number;
  children?: Capability[];
}

const IMPORTANCE_OPTIONS = ['critical', 'high', 'medium', 'low'] as const;
const IMPORTANCE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
};

const CapabilityMapper: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { selectedOrg } = useSelectedOrg();

  const orgId: number | null = isAdmin && selectedOrg
    ? selectedOrg.org_id
    : user?.org_id ?? null;

  const isReadOnly = user?.role === 'client-architect' || isAdmin;
  const canEdit = !isReadOnly || isAdmin;

  const [l1Caps, setL1Caps] = useState<Capability[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mission, setMission] = useState('');
  const [goals, setGoals] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (orgId) loadData();
  }, [orgId]);

  const loadData = async () => {
    if (!isSupabaseConfigured() || !supabase || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [capRes, orgRes] = await Promise.all([
        supabase
          .from('business_capabilities')
          .select('*')
          .eq('org_id', orgId)
          .order('level')
          .order('sort_order'),
        supabase
          .from('client_orgs')
          .select('mission_statement, strategic_goals')
          .eq('org_id', orgId)
          .single(),
      ]);

      if (orgRes.data) {
        setMission(orgRes.data.mission_statement ?? '');
        setGoals(orgRes.data.strategic_goals ?? '');
      }

      const flat: Capability[] = (capRes.data ?? []).map((r: any) => ({
        ...r,
        children: [],
      }));

      // Build tree
      const map: Record<string, Capability> = {};
      flat.forEach(c => (map[c.id] = c));
      const roots: Capability[] = [];
      flat.forEach(c => {
        if (c.parent_id && map[c.parent_id]) {
          map[c.parent_id].children!.push(c);
        } else if (!c.parent_id) {
          roots.push(c);
        }
      });
      setL1Caps(roots);
    } catch (e) {
      setError('Failed to load capabilities');
    } finally {
      setLoading(false);
    }
  };

  const saveMission = async () => {
    if (!isSupabaseConfigured() || !supabase || !orgId) return;
    await supabase.from('client_orgs').update({ mission_statement: mission, strategic_goals: goals }).eq('org_id', orgId);
    showSaved();
  };

  const addCapability = async (level: number, parentId: string | null) => {
    if (!isSupabaseConfigured() || !supabase || !orgId) return;
    setSaving('new');
    const { data, error } = await supabase
      .from('business_capabilities')
      .insert({
        org_id: orgId,
        level,
        parent_id: parentId,
        name: `New ${level === 1 ? 'L1' : level === 2 ? 'L2' : 'L3'} Capability`,
        description: '',
        is_ai_priority: false,
        strategic_importance: 'medium',
        sort_order: 0,
        created_by: user?.id,
      })
      .select()
      .single();
    setSaving(null);
    if (!error && data) {
      await loadData();
      if (parentId) setExpanded(prev => new Set([...prev, parentId]));
    }
  };

  const updateCapability = async (id: string, field: string, value: any) => {
    if (!isSupabaseConfigured() || !supabase) return;
    setSaving(id);
    await supabase.from('business_capabilities').update({ [field]: value }).eq('id', id);
    setSaving(null);
    await loadData();
  };

  const deleteCapability = async (id: string) => {
    if (!isSupabaseConfigured() || !supabase) return;
    if (!confirm('Delete this capability and all its children?')) return;
    await supabase.from('business_capabilities').delete().eq('id', id);
    await loadData();
  };

  const showSaved = () => {
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const CapRow: React.FC<{ cap: Capability; depth: number }> = ({ cap, depth }) => {
    const [localName, setLocalName] = useState(cap.name);
    const [localDesc, setLocalDesc] = useState(cap.description ?? '');
    const isExpanded = expanded.has(cap.id);
    const hasChildren = (cap.children?.length ?? 0) > 0;
    const isSaving = saving === cap.id;

    const indentClass = depth === 0 ? '' : depth === 1 ? 'ml-6' : 'ml-12';
    const bgClass = depth === 0
      ? 'bg-white border-gray-200'
      : depth === 1
      ? 'bg-gray-50 border-gray-100'
      : 'bg-gray-100/50 border-gray-100';

    return (
      <div className={`${indentClass} mb-2`}>
        <div className={`border rounded-lg p-3 ${bgClass} transition-shadow hover:shadow-sm`}>
          <div className="flex items-start gap-2">
            {hasChildren && (
              <button onClick={() => toggleExpand(cap.id)} className="mt-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
            {!hasChildren && <div className="w-4 flex-shrink-0" />}

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400">L{cap.level}</span>
                {canEdit ? (
                  <input
                    value={localName}
                    onChange={e => setLocalName(e.target.value)}
                    onBlur={() => { if (localName !== cap.name) updateCapability(cap.id, 'name', localName); }}
                    className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none min-w-0"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-900">{cap.name}</span>
                )}
                {canEdit && (
                  <select
                    value={cap.strategic_importance}
                    onChange={e => updateCapability(cap.id, 'strategic_importance', e.target.value)}
                    className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                  >
                    {IMPORTANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                <span className={`text-xs px-1.5 py-0.5 rounded ${IMPORTANCE_COLORS[cap.strategic_importance]}`}>
                  {cap.strategic_importance}
                </span>
                {canEdit && (
                  <button
                    onClick={() => updateCapability(cap.id, 'is_ai_priority', !cap.is_ai_priority)}
                    title="Toggle AI Priority"
                    className={`text-xs flex items-center gap-0.5 ${cap.is_ai_priority ? 'text-yellow-600' : 'text-gray-300'}`}
                  >
                    <Star className="h-3.5 w-3.5" fill={cap.is_ai_priority ? 'currentColor' : 'none'} />
                    <span className="hidden sm:inline">AI</span>
                  </button>
                )}
                {isSaving && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
              </div>
              {canEdit && (
                <input
                  value={localDesc}
                  placeholder="Add description..."
                  onChange={e => setLocalDesc(e.target.value)}
                  onBlur={() => { if (localDesc !== cap.description) updateCapability(cap.id, 'description', localDesc); }}
                  className="w-full text-xs text-gray-500 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-300 focus:outline-none"
                />
              )}
              {!canEdit && cap.description && (
                <p className="text-xs text-gray-500">{cap.description}</p>
              )}
            </div>

            {canEdit && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                {cap.level < 3 && (
                  <button
                    onClick={() => addCapability(cap.level + 1, cap.id)}
                    title={`Add L${cap.level + 1} sub-capability`}
                    className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => deleteCapability(cap.id)}
                  className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {isExpanded && cap.children?.map(child => (
          <CapRow key={child.id} cap={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  if (!orgId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500">
        Select an organization to manage capabilities.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading capabilities...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Business Capabilities</h1>
        <p className="text-gray-500 text-sm">Map your organization's business capabilities at L1 · L2 · L3 levels</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Mission & Goals */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Organisation context</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mission / vision statement</label>
            <textarea
              value={mission}
              onChange={e => setMission(e.target.value)}
              readOnly={!canEdit}
              rows={3}
              placeholder="Enter the organization's mission or vision..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Strategic goals</label>
            <textarea
              value={goals}
              onChange={e => setGoals(e.target.value)}
              readOnly={!canEdit}
              rows={3}
              placeholder="Key strategic goals and priorities..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none disabled:bg-gray-50"
            />
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={saveMission}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save context
            </button>
            {savedMsg && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" fill="currentColor" /> AI priority capability</span>
        <span>L1 = Top-level · L2 = Sub-domain · L3 = Process</span>
      </div>

      {/* Capability tree */}
      <div className="mb-4">
        {l1Caps.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm mb-3">No capabilities defined yet.</p>
            {canEdit && (
              <button
                onClick={() => addCapability(1, null)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add first L1 capability
              </button>
            )}
          </div>
        )}
        {l1Caps.map(cap => (
          <CapRow key={cap.id} cap={cap} depth={0} />
        ))}
      </div>

      {canEdit && l1Caps.length > 0 && (
        <button
          onClick={() => addCapability(1, null)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 rounded-lg px-4 py-2 w-full justify-center hover:bg-blue-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add L1 capability
        </button>
      )}
    </div>
  );
};

export default CapabilityMapper;
