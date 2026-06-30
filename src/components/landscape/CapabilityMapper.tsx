import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Save, Loader2,
  AlertCircle, CheckCircle, Star, Upload, Sparkles, Network,
  X, Check, RefreshCw, Pencil, Search,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOrg } from '../../contexts/SelectedOrgContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  parseCSV, parseExcel, rowsToTree, importCapabilityTree,
  generateCapabilityModel, getAssetMappingSuggestions, saveAssetMappings,
  getAssetMappingsForOrg, clearAssetMappings, deleteAssetMapping, addSingleAssetMapping,
  CapabilityNode, FlatCapability, MappingSuggestion, ParsedRow,
} from '../../services/capabilityService';

// ── Local Types ───────────────────────────────────────────────────────────────

interface Capability {
  id: string;
  name: string;
  description: string | null;
  level: number;
  parent_id: string | null;
  is_ai_priority: boolean;
  strategic_importance: 'critical' | 'high' | 'medium' | 'low';
  sort_order: number;
  children?: Capability[];
}

interface FlatMapping {
  capId: string;
  capName: string;
  assetId: string;
  assetName: string;
  confidence: number;
  displayType: 'primary' | 'secondary' | 'enabling';
  rationale: string;
}

// ── Module-level helpers ──────────────────────────────────────────────────────

const IMPORTANCE_OPTIONS = ['critical', 'high', 'medium', 'low'] as const;

const IMPORTANCE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
};

const SECTORS = [
  'Financial Services', 'Healthcare', 'Retail & E-commerce', 'Manufacturing',
  'Technology', 'Government & Public Sector', 'Education', 'Media & Entertainment',
  'Professional Services', 'Energy & Utilities', 'Logistics & Supply Chain', 'Other',
];

const ORG_SIZES = [
  'Startup (< 50 employees)', 'SMB (50–500 employees)',
  'Mid-market (500–5,000 employees)', 'Enterprise (5,000+ employees)', 'Government / Public Sector',
];

const CORE_FUNCTIONS = [
  'Finance & Accounting', 'Human Resources', 'Sales',
  'Marketing', 'Customer Service', 'Operations',
  'IT & Technology', 'Supply Chain', 'R&D / Innovation',
  'Legal & Compliance', 'Risk Management', 'Procurement',
];

function countCapNodes(nodes: CapabilityNode[]): { l1: number; l2: number; l3: number } {
  let l1 = 0, l2 = 0, l3 = 0;
  const visit = (n: CapabilityNode) => {
    if (n.level === 1) l1++;
    else if (n.level === 2) l2++;
    else l3++;
    n.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return { l1, l2, l3 };
}

function flattenLeafCaps(caps: Capability[]): FlatCapability[] {
  const result: FlatCapability[] = [];
  const visit = (cap: Capability) => {
    if (!cap.children?.length) {
      result.push({
        id: cap.id, name: cap.name,
        description: cap.description ?? '',
        level: cap.level, parent_id: cap.parent_id,
        strategic_importance: cap.strategic_importance,
        is_ai_priority: cap.is_ai_priority,
      });
    } else {
      cap.children.forEach(visit);
    }
  };
  caps.forEach(visit);
  return result;
}

const confColor = (c: number) =>
  c >= 0.85 ? 'bg-green-500' : c >= 0.60 ? 'bg-blue-500' : 'bg-yellow-500';

// ── File Import Modal ─────────────────────────────────────────────────────────

interface FileImportModalProps {
  orgId: number;
  userId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const FileImportModal: React.FC<FileImportModalProps> = ({ orgId, userId, onSuccess, onClose }) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [tree, setTree] = useState<CapabilityNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      let rows: ParsedRow[];
      if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
        rows = parseCSV(await file.text());
      } else if (file.name.match(/\.xlsx?$/i)) {
        rows = parseExcel(await file.arrayBuffer());
      } else {
        setError('Unsupported file type. Please use CSV, XLS, or XLSX.');
        return;
      }
      if (!rows.length) { setError('No data found. Verify the file has L1/L2/L3 columns.'); return; }
      const built = rowsToTree(rows);
      if (!built.length) { setError('Could not build capability tree. Check column layout.'); return; }
      setTree(built);
      setStep('preview');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to parse file.');
    }
  };

  const doImport = async () => {
    setStep('importing');
    try {
      await importCapabilityTree(orgId, tree, userId, replaceExisting);
      onSuccess();
    } catch (e: any) {
      setError(e?.message ?? 'Import failed.');
      setStep('preview');
    }
  };

  const counts = step === 'preview' ? countCapNodes(tree) : null;
  const total = counts ? counts.l1 + counts.l2 + counts.l3 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Import Business Capabilities</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}

          {step === 'upload' && (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Upload CSV, XLS, or XLSX with L1 / L2 / L3 columns. Hierarchical fill-down is supported.
              </p>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">Drag & drop or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">CSV · XLS · XLSX</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
              <div className="mt-5 bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-1">
                <p className="font-medium mb-1">Supported column layouts:</p>
                <p>• <strong>Explicit:</strong> L1 | L2 | L3 | Description</p>
                <p>• <strong>Named:</strong> Domain · Sub-domain · Capability · Process (auto-detected)</p>
                <p>• <strong>Hierarchical:</strong> L1 filled only at top, L2/L3 below (fill-down)</p>
              </div>
            </>
          )}

          {step === 'preview' && counts && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-blue-500 font-medium mb-0.5">Ready to import: {fileName}</p>
                <p className="text-sm text-blue-800 font-semibold">
                  {counts.l1} L1 domains · {counts.l2} L2 sub-domains · {counts.l3} L3 processes
                </p>
              </div>
              <div className="border border-gray-100 rounded-lg max-h-64 overflow-y-auto mb-4">
                {tree.slice(0, 25).map((l1, i) => (
                  <div key={i} className="px-4 py-2 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-semibold text-gray-800">{l1.name}</p>
                    {l1.children?.slice(0, 4).map((l2, j) => (
                      <p key={j} className="pl-4 text-xs text-gray-600 py-0.5">
                        {l2.name}
                        {l2.children?.length ? <span className="text-gray-400 ml-1">({l2.children.length} L3)</span> : null}
                      </p>
                    ))}
                    {(l1.children?.length ?? 0) > 4 && (
                      <p className="pl-4 text-xs text-gray-400">+{(l1.children?.length ?? 0) - 4} more</p>
                    )}
                  </div>
                ))}
                {tree.length > 25 && <p className="px-4 py-2 text-xs text-gray-400">+{tree.length - 25} more L1 domains</p>}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600" />
                <span className="text-gray-700">Replace existing capabilities</span>
                <span className="text-xs text-gray-400">(uncheck to append)</span>
              </label>
            </>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="text-gray-600 text-sm">Importing {total} capabilities...</p>
            </div>
          )}
        </div>

        {step !== 'importing' && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={step === 'preview' ? () => { setStep('upload'); setTree([]); } : onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
            >
              {step === 'preview' ? '← Back' : 'Cancel'}
            </button>
            {step === 'preview' && counts && (
              <button onClick={doImport}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Import {total} capabilities
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── AI Generator Modal ────────────────────────────────────────────────────────

interface AIGeneratorModalProps {
  orgId: number;
  userId: string;
  mission: string;
  goals: string;
  onSuccess: () => void;
  onClose: () => void;
}

const INITIAL_ANSWERS = {
  sector: '',
  org_size: '',
  business_model: '',
  customers: '',
  core_functions: [] as string[],
  strategic_priorities: '',
  tech_challenges: '',
};

const AIGeneratorModal: React.FC<AIGeneratorModalProps> = ({ orgId, userId, mission, goals, onSuccess, onClose }) => {
  const [step, setStep] = useState<'questions' | 'generating' | 'preview' | 'importing'>('questions');
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [tree, setTree] = useState<CapabilityNode[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetHints, setAssetHints] = useState<string[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  useEffect(() => {
    fetchAssetHints();
  }, []);

  const fetchAssetHints = async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    setLoadingAssets(true);
    try {
      const { data } = await supabase
        .from('it_assets')
        .select('name, type, category, business_unit, tags, description')
        .eq('org_id', orgId)
        .limit(100);
      if (data?.length) {
        const hints = data.map((a: any) => {
          const parts: string[] = [a.name];
          if (a.category) parts.push(a.category);
          if (a.business_unit) parts.push(a.business_unit);
          if (Array.isArray(a.tags) && a.tags.length) parts.push(a.tags.slice(0, 3).join(', '));
          return parts.filter(Boolean).join(' | ');
        });
        setAssetHints(hints);
      }
    } catch {
      // non-critical, continue without asset hints
    } finally {
      setLoadingAssets(false);
    }
  };

  const toggleFunction = (fn: string) => {
    setAnswers(a => ({
      ...a,
      core_functions: a.core_functions.includes(fn)
        ? a.core_functions.filter(f => f !== fn)
        : [...a.core_functions, fn],
    }));
  };

  const canGenerate = answers.sector && answers.org_size && answers.business_model &&
    answers.customers && answers.core_functions.length > 0;

  const generate = async () => {
    setError(null);
    setStep('generating');
    try {
      const result = await generateCapabilityModel({
        ...answers,
        mission,
        strategic_goals: goals,
        existing_assets: assetHints,
      });
      if (!result.capabilities?.length) throw new Error('No capabilities returned from AI.');
      setTree(result.capabilities as CapabilityNode[]);
      setStep('preview');
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed. Please try again.');
      setStep('questions');
    }
  };

  const doImport = async () => {
    setStep('importing');
    try {
      await importCapabilityTree(orgId, tree, userId, replaceExisting);
      onSuccess();
    } catch (e: any) {
      setError(e?.message ?? 'Import failed.');
      setStep('preview');
    }
  };

  const counts = step === 'preview' ? countCapNodes(tree) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-base font-semibold text-gray-900">Generate Capability Model with AI</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}

          {step === 'questions' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">
                Answer a few questions and AI will generate a tailored L1 · L2 · L3 capability model.
                {assetHints.length > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {assetHints.length} IT assets detected and will be used to align capabilities.
                  </span>
                )}
                {loadingAssets && <span className="ml-1 text-gray-400 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading asset context…</span>}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sector / Industry <span className="text-red-500">*</span></label>
                  <select value={answers.sector} onChange={e => setAnswers(a => ({ ...a, sector: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-purple-400 focus:border-purple-400 focus:outline-none bg-white">
                    <option value="">Select sector…</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Organisation size <span className="text-red-500">*</span></label>
                  <select value={answers.org_size} onChange={e => setAnswers(a => ({ ...a, org_size: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-purple-400 focus:border-purple-400 focus:outline-none bg-white">
                    <option value="">Select size…</option>
                    {ORG_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Business model <span className="text-red-500">*</span></label>
                <input value={answers.business_model} onChange={e => setAnswers(a => ({ ...a, business_model: e.target.value }))}
                  placeholder="e.g. SaaS platform selling subscription licences to mid-market banks"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-purple-400 focus:border-purple-400 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Primary customers / stakeholders <span className="text-red-500">*</span></label>
                <input value={answers.customers} onChange={e => setAnswers(a => ({ ...a, customers: e.target.value }))}
                  placeholder="e.g. CFOs and finance teams at banks with 500–5,000 employees"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-purple-400 focus:border-purple-400 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Core business functions <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CORE_FUNCTIONS.map(fn => (
                    <label key={fn} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <input type="checkbox" checked={answers.core_functions.includes(fn)} onChange={() => toggleFunction(fn)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-400" />
                      <span className="text-gray-700">{fn}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Strategic priorities (3-year horizon)</label>
                <textarea value={answers.strategic_priorities} onChange={e => setAnswers(a => ({ ...a, strategic_priorities: e.target.value }))}
                  placeholder="e.g. Expand into Asia-Pacific, reduce costs by 20%, launch AI product line"
                  rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Key technology challenges</label>
                <textarea value={answers.tech_challenges} onChange={e => setAnswers(a => ({ ...a, tech_challenges: e.target.value }))}
                  placeholder="e.g. Legacy ERP, data silos between departments, manual reporting"
                  rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 focus:outline-none" />
              </div>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center py-16 gap-5">
              <div className="relative w-14 h-14">
                <Sparkles className="h-14 w-14 text-purple-200" />
                <Loader2 className="h-14 w-14 animate-spin text-purple-600 absolute inset-0" />
              </div>
              <p className="text-gray-700 font-medium text-center">AI is building your capability model…</p>
              <p className="text-gray-400 text-sm text-center max-w-xs">
                Analysing organisation profile{assetHints.length ? ` and ${assetHints.length} IT asset hints` : ''} to generate L1 → L2 → L3 capabilities. Takes ~20–40 seconds.
              </p>
            </div>
          )}

          {step === 'preview' && counts && (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-purple-500 font-medium mb-0.5">AI-generated model</p>
                <p className="text-sm text-purple-800 font-semibold">
                  {counts.l1} L1 domains · {counts.l2} L2 sub-domains · {counts.l3} L3 processes
                </p>
              </div>
              <div className="border border-gray-100 rounded-lg max-h-64 overflow-y-auto mb-4">
                {tree.map((l1, i) => (
                  <div key={i} className="px-4 py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{l1.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${IMPORTANCE_COLORS[l1.strategic_importance]}`}>
                        {l1.strategic_importance}
                      </span>
                      {l1.is_ai_priority && <Star className="h-3 w-3 text-yellow-500" fill="currentColor" />}
                    </div>
                    {l1.children?.slice(0, 4).map((l2, j) => (
                      <p key={j} className="pl-4 text-xs text-gray-600 py-0.5">
                        {l2.name}
                        {l2.children?.length ? <span className="text-gray-400 ml-1">({l2.children.length} L3)</span> : null}
                      </p>
                    ))}
                    {(l1.children?.length ?? 0) > 4 && (
                      <p className="pl-4 text-xs text-gray-400">+{(l1.children?.length ?? 0) - 4} more</p>
                    )}
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600" />
                <span className="text-gray-700">Replace existing capabilities</span>
              </label>
            </>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
              <p className="text-gray-600 text-sm">Importing capabilities…</p>
            </div>
          )}
        </div>

        {step !== 'generating' && step !== 'importing' && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={step === 'preview' ? () => { setStep('questions'); setTree([]); } : onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
            >
              {step === 'preview' ? '← Back' : 'Cancel'}
            </button>
            {step === 'questions' && (
              <button onClick={generate} disabled={!canGenerate}
                className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Sparkles className="h-4 w-4" />
                Generate model
              </button>
            )}
            {step === 'preview' && (
              <button onClick={doImport}
                className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">
                <Check className="h-4 w-4" />
                Use this model
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Asset Mapper Modal ────────────────────────────────────────────────────────

interface AssetMapperModalProps {
  orgId: number;
  userId: string;
  capabilities: Capability[];
  onClose: () => void;
}

type ExistingMapping = {
  id: string;
  capability_id: string;
  asset_id: string;
  confidence_score: number;
  mapping_type: string;
  rationale: string;
  business_capabilities: { name: string; level: number } | null;
  it_assets: { name: string; type: string } | null;
};

type MapperStep = 'init' | 'view' | 'ai-running' | 'review' | 'saving' | 'done';

const MappingTable: React.FC<{
  rows: { capName: string; assetName: string; assetType?: string; confidence: number; mappingType: string; rationale: string }[];
  selectable?: boolean;
  accepted?: Set<string>;
  rowKey?: (i: number) => string;
  onToggle?: (key: string) => void;
  onDelete?: (i: number) => void;
}> = ({ rows, selectable, accepted, rowKey, onToggle, onDelete }) => (
  <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg">
    <table className="w-full text-sm min-w-[560px]">
      <thead className="bg-gray-50 sticky top-0 z-10">
        <tr>
          {selectable && <th className="w-8 px-3 py-2.5" />}
          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Capability</th>
          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Asset</th>
          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-28">Confidence</th>
          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-24">Type</th>
          {onDelete && <th className="w-8 px-3 py-2.5" />}
        </tr>
      </thead>
      <tbody>
        {rows.map((m, i) => {
          const key = rowKey ? rowKey(i) : String(i);
          const isAcc = selectable ? accepted?.has(key) : false;
          return (
            <tr key={i} className={`border-t border-gray-50 transition-colors ${isAcc ? 'bg-green-50/40' : 'hover:bg-gray-50'}`}>
              {selectable && (
                <td className="px-3 py-2.5">
                  <button onClick={() => onToggle?.(key)}
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                      isAcc ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                    }`}>
                    {isAcc && <Check className="h-3 w-3" />}
                  </button>
                </td>
              )}
              <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[200px]">
                <span className="block truncate" title={m.rationale ? `${m.capName} — ${m.rationale}` : m.capName}>
                  {m.capName}
                </span>
              </td>
              <td className="px-3 py-2.5 text-gray-600 max-w-[160px]">
                <span className="block truncate" title={m.assetName}>{m.assetName}</span>
                {m.assetType && <span className="block text-xs text-gray-400">{m.assetType}</span>}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                    <div className={`h-full rounded-full ${confColor(m.confidence)}`}
                      style={{ width: `${Math.round(m.confidence * 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{Math.round(m.confidence * 100)}%</span>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                  m.mappingType === 'primary' ? 'bg-blue-100 text-blue-700' :
                  m.mappingType === 'ai_suggested' ? 'bg-blue-100 text-blue-700' :
                  m.mappingType === 'secondary' ? 'bg-purple-100 text-purple-700' :
                  m.mappingType === 'enabling' ? 'bg-teal-100 text-teal-700' :
                  m.mappingType === 'manual' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{m.mappingType}</span>
              </td>
              {onDelete && (
                <td className="px-2 py-2.5">
                  <button onClick={() => onDelete(i)} title="Remove mapping"
                    className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          );
        })}
        {!rows.length && (
          <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No mappings found.</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

const AssetMapperModal: React.FC<AssetMapperModalProps> = ({ orgId, userId, capabilities, onClose }) => {
  const [step, setStep] = useState<MapperStep>('init');
  const [existing, setExisting] = useState<ExistingMapping[]>([]);
  const [flatMappings, setFlatMappings] = useState<FlatMapping[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [showManualEdit, setShowManualEdit] = useState(false);

  useEffect(() => { loadExisting(); }, []);

  const loadExisting = async () => {
    try {
      const data = await getAssetMappingsForOrg(orgId) as ExistingMapping[];
      setExisting(data);
      setStep(data.length > 0 ? 'view' : 'ai-running');
      if (!data.length) runMapping();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load mappings.');
      setStep('view');
    }
  };

  const runMapping = async () => {
    setError(null);
    setStep('ai-running');
    try {
      const leafCaps = flattenLeafCaps(capabilities);
      if (!leafCaps.length) throw new Error('No leaf capabilities found. Add capabilities first.');

      if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase not configured');
      const { data: assetData, error: assetErr } = await supabase
        .from('it_assets')
        .select('id, name, type, category, description, tags')
        .eq('org_id', orgId)
        .limit(200);

      if (assetErr) throw assetErr;
      if (!assetData?.length) throw new Error('No IT assets found. Upload assets first.');

      const assets = assetData.map((a: any) => ({
        id: a.id, name: a.name ?? '', type: a.type ?? '',
        category: a.category ?? '', description: a.description ?? '',
        tags: Array.isArray(a.tags) ? a.tags : [],
      }));

      const result = await getAssetMappingSuggestions(leafCaps, assets);
      const suggestions = result.mappings as MappingSuggestion[];

      const flat: FlatMapping[] = [];
      for (const s of suggestions) {
        for (const asset of s.supporting_assets) {
          flat.push({
            capId: s.capability_id, capName: s.capability_name,
            assetId: asset.asset_id, assetName: asset.asset_name,
            confidence: asset.confidence, displayType: asset.mapping_type,
            rationale: asset.rationale,
          });
        }
      }

      const defaultAccepted = new Set(
        flat.filter(m => m.confidence >= 0.7).map(m => `${m.capId}|${m.assetId}`)
      );
      setFlatMappings(flat);
      setAccepted(defaultAccepted);
      setStep('review');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate mappings.');
      setStep(existing.length > 0 ? 'view' : 'review');
    }
  };

  const handleRedoMapping = () => {
    setFlatMappings([]);
    setAccepted(new Set());
    runMapping();
  };

  const toggleAccept = (key: string) => {
    setAccepted(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const saveMappings = async () => {
    setStep('saving');
    const toSave = flatMappings
      .filter(m => accepted.has(`${m.capId}|${m.assetId}`))
      .map(m => ({
        assetId: m.assetId, capabilityId: m.capId,
        confidence: m.confidence, mappingType: 'ai_suggested' as const,
        rationale: `[${m.displayType}] ${m.rationale}`,
      }));
    try {
      await clearAssetMappings(orgId);
      await saveAssetMappings(orgId, toSave, userId);
      setSavedCount(toSave.length);
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.');
      setStep('review');
    }
  };

  const acceptedCount = accepted.size;

  const titles: Record<MapperStep, string> = {
    init: 'Loading Mappings…',
    view: 'Capability → Asset Mappings',
    'ai-running': 'Mapping Capabilities to Assets…',
    review: 'Review AI Suggestions',
    saving: 'Saving Mappings…',
    done: 'Mappings Saved',
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-green-600" />
            <h2 className="text-base font-semibold text-gray-900">{titles[step]}</h2>
          </div>
          <div className="flex items-center gap-2">
            {step === 'view' && (
              <>
                <button onClick={() => setShowManualEdit(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Manually
                </button>
                <button onClick={handleRedoMapping}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-orange-200 text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Redo Mapping
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}

          {(step === 'init' || step === 'ai-running') && (
            <div className="flex flex-col items-center py-16 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-green-600" />
              <p className="text-gray-700 font-medium">
                {step === 'init' ? 'Loading existing mappings…' : 'AI is mapping capabilities to assets…'}
              </p>
              {step === 'ai-running' && (
                <p className="text-gray-400 text-sm text-center max-w-sm">
                  Analysing leaf-level capabilities against your IT asset inventory. This may take 20–40 seconds.
                </p>
              )}
            </div>
          )}

          {step === 'view' && (
            <>
              <p className="text-sm text-gray-500 mb-3">
                <span className="font-semibold text-gray-800">{existing.length}</span> saved mapping{existing.length !== 1 ? 's' : ''}.
                Hover a capability name to see its rationale.
              </p>
              <MappingTable
                rows={existing.map(m => ({
                  capName: m.business_capabilities?.name ?? m.capability_id,
                  assetName: m.it_assets?.name ?? m.asset_id,
                  assetType: m.it_assets?.type,
                  confidence: m.confidence_score,
                  mappingType: m.mapping_type,
                  rationale: m.rationale,
                }))}
                onDelete={async (i) => {
                  const target = existing[i];
                  await deleteAssetMapping(target.id);
                  setExisting(prev => prev.filter((_, idx) => idx !== i));
                }}
              />
            </>
          )}

          {step === 'review' && (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{flatMappings.length}</span> suggested ·{' '}
                  <span className="font-semibold text-green-700">{acceptedCount} accepted</span>
                  <span className="text-gray-400 ml-2 text-xs">(≥70% confidence pre-selected)</span>
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAccepted(new Set(flatMappings.map(m => `${m.capId}|${m.assetId}`)))}
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded">
                    Select all
                  </button>
                  <button onClick={() => setAccepted(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded">
                    Clear
                  </button>
                </div>
              </div>
              <MappingTable
                rows={flatMappings.map(m => ({
                  capName: m.capName, assetName: m.assetName,
                  confidence: m.confidence, mappingType: m.displayType,
                  rationale: m.rationale,
                }))}
                selectable
                accepted={accepted}
                rowKey={i => `${flatMappings[i].capId}|${flatMappings[i].assetId}`}
                onToggle={toggleAccept}
              />
            </>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-green-600" />
              <p className="text-gray-600 text-sm">Saving mappings…</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-12 gap-4">
              <CheckCircle className="h-14 w-14 text-green-500" />
              <p className="text-gray-800 font-semibold text-lg">{savedCount} mapping{savedCount !== 1 ? 's' : ''} saved</p>
              <p className="text-gray-400 text-sm">All previous mappings were replaced.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors">
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          {step === 'review' && flatMappings.length > 0 && (
            <button onClick={saveMappings} disabled={!acceptedCount}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Check className="h-4 w-4" />
              Save {acceptedCount} mapping{acceptedCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>

    {showManualEdit && (
      <ManualMappingModal
        orgId={orgId}
        userId={userId}
        onClose={() => {
          setShowManualEdit(false);
          loadExisting();
        }}
      />
    )}
    </>
  );
};

// ── Manual Mapping Modal ──────────────────────────────────────────────────────

interface ManualMappingModalProps {
  orgId: number;
  userId: string;
  initialAssetId?: string;
  onClose: () => void;
}

type ManualMapping = {
  id: string;
  capability_id: string;
  mapping_type: string;
  rationale: string;
  business_capabilities: { name: string } | null;
};

type AssetOption = { id: string; name: string; type: string; status: string; criticality: string; description: string; owner: string; vendor?: string };
type CapOption = { id: string; name: string; level: number; parent_id: string | null };

function buildBreadcrumb(capId: string, allCaps: CapOption[]): string {
  const parts: string[] = [];
  let current = allCaps.find(c => c.id === capId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? allCaps.find(c => c.id === current!.parent_id) : undefined;
  }
  return parts.join(' › ');
}

const LEVEL_BADGE: Record<number, string> = {
  1: 'bg-violet-100 text-violet-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-teal-100 text-teal-700',
};

export const ManualMappingModal: React.FC<ManualMappingModalProps> = ({ orgId, userId, initialAssetId, onClose }) => {
  const [assets, setAssets]         = useState<AssetOption[]>([]);
  const [allCaps, setAllCaps]       = useState<CapOption[]>([]);
  const [selectedId, setSelectedId] = useState(initialAssetId ?? '');
  const [mappings, setMappings]     = useState<ManualMapping[]>([]);
  const [addL1Id, setAddL1Id]       = useState('');
  const [addL2Id, setAddL2Id]       = useState('');
  const [addL3Id, setAddL3Id]       = useState('');
  const [addType, setAddType]       = useState<'primary' | 'secondary' | 'enabling'>('primary');
  const [adding, setAdding]         = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState('');

  useEffect(() => { fetchStaticData(); }, []);
  useEffect(() => { if (selectedId) fetchMappings(selectedId); }, [selectedId]);

  const fetchStaticData = async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    const [assetRes, capRes] = await Promise.all([
      supabase.from('it_assets').select('id, name, type, status, criticality, description, owner, vendor').eq('org_id', orgId).order('name'),
      supabase.from('business_capabilities').select('id, name, level, parent_id').eq('org_id', orgId).order('level').order('sort_order'),
    ]);
    if (assetRes.data) setAssets(assetRes.data as AssetOption[]);
    if (capRes.data) setAllCaps(capRes.data as CapOption[]);
    if (!initialAssetId && assetRes.data?.length) setSelectedId(assetRes.data[0].id);
  };

  const fetchMappings = async (assetId: string) => {
    if (!isSupabaseConfigured() || !supabase) return;
    setLoadingMappings(true);
    const { data } = await supabase
      .from('asset_capability_mappings')
      .select('id, capability_id, mapping_type, rationale, business_capabilities(name)')
      .eq('org_id', orgId)
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });
    setMappings((data ?? []) as unknown as ManualMapping[]);
    setLoadingMappings(false);
  };

  const resetAddState = () => { setAddL1Id(''); setAddL2Id(''); setAddL3Id(''); };

  const handleAdd = async () => {
    const capId = addL3Id || addL2Id || addL1Id;
    if (!capId || !selectedId) return;
    setAdding(true);
    setError(null);
    try {
      await addSingleAssetMapping(orgId, selectedId, capId, addType, userId);
      await fetchMappings(selectedId);
      resetAddState();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add mapping.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (mapping: ManualMapping) => {
    try {
      await deleteAssetMapping(mapping.id);
      setMappings(prev => prev.filter(m => m.id !== mapping.id));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete mapping.');
    }
  };

  const selectedAsset  = assets.find(a => a.id === selectedId);
  const mappedCapIds   = new Set(mappings.map(m => m.capability_id));
  const filteredAssets = assetSearch
    ? assets.filter(a => a.name.toLowerCase().includes(assetSearch.toLowerCase()))
    : assets;

  // Cascading cap lists (exclude already-mapped caps at each level)
  const l1Caps = allCaps.filter(c => c.level === 1 && !mappedCapIds.has(c.id));
  const l2Caps = addL1Id ? allCaps.filter(c => c.level === 2 && c.parent_id === addL1Id && !mappedCapIds.has(c.id)) : [];
  const l3Caps = addL2Id ? allCaps.filter(c => c.level === 3 && c.parent_id === addL2Id && !mappedCapIds.has(c.id)) : [];
  const selectedCapId = addL3Id || addL2Id || addL1Id;
  const selectedCapLevel = addL3Id ? 3 : addL2Id ? 2 : addL1Id ? 1 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Edit Capability Mappings</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
          </div>
        )}

        {/* Two-panel body */}
        <div className="flex-1 overflow-hidden flex">

          {/* Left — capability management */}
          <div className="flex-1 flex flex-col border-r border-gray-100 px-6 py-5 overflow-hidden">

            {/* Asset selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Asset</label>
              <div className="relative mb-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder="Search assets…"
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none"
                />
              </div>
              <select
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); resetAddState(); }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none bg-white"
                size={Math.min(filteredAssets.length + 1, 4)}
              >
                {filteredAssets.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Mapped capabilities list */}
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Mapped capabilities</p>
            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg mb-4">
              {loadingMappings ? (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : mappings.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">No capabilities mapped yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {mappings.map(m => {
                      const cap = allCaps.find(c => c.id === m.capability_id);
                      const breadcrumb = allCaps.length ? buildBreadcrumb(m.capability_id, allCaps) : (m.business_capabilities?.name ?? m.capability_id);
                      return (
                        <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
                          <td className="px-3 py-2.5 w-6">
                            {cap && (
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${LEVEL_BADGE[cap.level] ?? 'bg-gray-100 text-gray-600'}`}>
                                L{cap.level}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-gray-800">
                            <span className="block text-xs text-gray-400 leading-none mb-0.5">{breadcrumb.split(' › ').slice(0, -1).join(' › ')}</span>
                            <span className="font-medium">{m.business_capabilities?.name ?? m.capability_id}</span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {(() => {
                              const rel = m.rationale?.match(/^\[(primary|secondary|enabling|ai_suggested|confirmed|manual)\]/)?.[1] ?? m.mapping_type;
                              return (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  rel === 'primary'      ? 'bg-blue-100 text-blue-700' :
                                  rel === 'secondary'    ? 'bg-purple-100 text-purple-700' :
                                  rel === 'enabling'     ? 'bg-teal-100 text-teal-700' :
                                  rel === 'ai_suggested' ? 'bg-orange-100 text-orange-700' :
                                  'bg-green-100 text-green-700'
                                }`}>{rel}</span>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <button onClick={() => handleDelete(m)} title="Remove"
                              className="text-gray-200 group-hover:text-red-400 hover:text-red-600 transition-colors p-0.5 rounded">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add capability — cascading L1 → L2 → L3 */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Add capability</p>
                <p className="text-xs text-gray-400">
                  Can't find one?{' '}
                  <a href="/landscape" className="text-blue-500 hover:text-blue-700 hover:underline">
                    Add it on the Capabilities page →
                  </a>
                </p>
              </div>
              <div className="space-y-2 mb-3">
                {/* L1 */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded w-7 text-center flex-shrink-0 ${LEVEL_BADGE[1]}`}>L1</span>
                  <select
                    value={addL1Id}
                    onChange={e => { setAddL1Id(e.target.value); setAddL2Id(''); setAddL3Id(''); }}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none bg-white"
                  >
                    <option value="">Select domain…</option>
                    {l1Caps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {/* L2 */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded w-7 text-center flex-shrink-0 ${addL1Id ? LEVEL_BADGE[2] : 'bg-gray-100 text-gray-300'}`}>L2</span>
                  <select
                    value={addL2Id}
                    onChange={e => { setAddL2Id(e.target.value); setAddL3Id(''); }}
                    disabled={!addL1Id}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">{addL1Id ? (l2Caps.length ? 'Select sub-domain…' : '— no sub-domains —') : 'Select L1 first…'}</option>
                    {l2Caps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {/* L3 */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded w-7 text-center flex-shrink-0 ${addL2Id && l3Caps.length ? LEVEL_BADGE[3] : 'bg-gray-100 text-gray-300'}`}>L3</span>
                  <select
                    value={addL3Id}
                    onChange={e => setAddL3Id(e.target.value)}
                    disabled={!addL2Id || l3Caps.length === 0}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">{addL2Id ? (l3Caps.length ? 'Select process…' : '— no processes —') : 'Select L2 first…'}</option>
                    {l3Caps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Selected capability preview + type + Add */}
              <div className="flex gap-2 items-center">
                <div className="flex-1 min-w-0">
                  {selectedCapId ? (
                    <p className="text-xs text-gray-600 truncate">
                      <span className={`font-bold mr-1 px-1 py-0.5 rounded text-xs ${LEVEL_BADGE[selectedCapLevel]}`}>L{selectedCapLevel}</span>
                      {buildBreadcrumb(selectedCapId, allCaps)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-300">Select at least L1 to map</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <select
                    value={addType}
                    onChange={e => setAddType(e.target.value as any)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none bg-white"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="enabling">Enabling</option>
                  </select>
                </div>
                <button onClick={handleAdd} disabled={!selectedCapId || adding}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Right — fixed asset detail */}
          <div className="w-72 flex-shrink-0 px-5 py-5 bg-gray-50 overflow-y-auto">
            {selectedAsset ? (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold text-gray-900">{selectedAsset.name}</p>
                  <p className="text-xs text-gray-500 capitalize mt-0.5">{selectedAsset.type.replace('-', ' ')}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      selectedAsset.status === 'active' ? 'bg-green-100 text-green-800' :
                      selectedAsset.status === 'deprecated' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>{selectedAsset.status}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      selectedAsset.criticality === 'high' ? 'bg-red-100 text-red-800' :
                      selectedAsset.criticality === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>{selectedAsset.criticality} criticality</span>
                  </div>
                </div>
                {selectedAsset.description && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{selectedAsset.description}</p>
                  </div>
                )}
                {selectedAsset.owner && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Owner</p>
                    <p className="text-xs text-gray-800">{selectedAsset.owner}</p>
                  </div>
                )}
                {selectedAsset.vendor && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Vendor</p>
                    <p className="text-xs text-gray-800">{selectedAsset.vendor}</p>
                  </div>
                )}
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400">{mappings.length} capability mapping{mappings.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center pt-8">Select an asset to begin.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const CapabilityMapper: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { selectedOrg } = useSelectedOrg();

  const orgId: number | null = isAdmin && selectedOrg
    ? selectedOrg.org_id
    : user?.org_id ?? null;

  const canEdit = isAdmin || user?.role === 'client-architect' || user?.role === 'client-cxo';

  const [l1Caps, setL1Caps] = useState<Capability[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mission, setMission] = useState('');
  const [goals, setGoals] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [mappingCount, setMappingCount] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [showAIGen, setShowAIGen] = useState(false);
  const [showMapper, setShowMapper] = useState(false);

  useEffect(() => { if (orgId) loadData(); }, [orgId]);

  const loadData = async () => {
    if (!isSupabaseConfigured() || !supabase || !orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [capRes, orgRes, mapRes] = await Promise.all([
        supabase.from('business_capabilities').select('*').eq('org_id', orgId).order('level').order('sort_order'),
        supabase.from('client_orgs').select('mission_statement, strategic_goals').eq('org_id', orgId).single(),
        supabase.from('asset_capability_mappings').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      ]);
      if (orgRes.data) {
        setMission(orgRes.data.mission_statement ?? '');
        setGoals(orgRes.data.strategic_goals ?? '');
      }
      setMappingCount(mapRes.count ?? 0);
      const flat: Capability[] = (capRes.data ?? []).map((r: any) => ({ ...r, children: [] }));
      const map: Record<string, Capability> = {};
      flat.forEach(c => (map[c.id] = c));
      const roots: Capability[] = [];
      flat.forEach(c => {
        if (c.parent_id && map[c.parent_id]) map[c.parent_id].children!.push(c);
        else if (!c.parent_id) roots.push(c);
      });
      setL1Caps(roots);
    } catch {
      setError('Failed to load capabilities');
    } finally {
      setLoading(false);
    }
  };

  const saveMissionGoals = async () => {
    if (!isSupabaseConfigured() || !supabase || !orgId) return;
    await supabase.from('client_orgs').update({ mission_statement: mission, strategic_goals: goals }).eq('org_id', orgId);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const addCapability = async (level: number, parentId: string | null) => {
    if (!isSupabaseConfigured() || !supabase || !orgId) return;
    setSaving('new');
    const { data, error: err } = await supabase.from('business_capabilities').insert({
      org_id: orgId, level, parent_id: parentId,
      name: `New ${level === 1 ? 'L1' : level === 2 ? 'L2' : 'L3'} Capability`,
      description: '', is_ai_priority: false, strategic_importance: 'medium', sort_order: 0, created_by: user?.id,
    }).select().single();
    setSaving(null);
    if (!err && data) {
      await loadData();
      if (parentId) setExpanded(prev => new Set([...prev, parentId]));
    }
  };

  const updateCapability = async (id: string, field: string, value: unknown) => {
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

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  // Defined inside main component so it closes over state; acceptable trade-off (same as original).
  const CapRow: React.FC<{ cap: Capability; depth: number }> = ({ cap, depth }) => {
    const [localName, setLocalName] = useState(cap.name);
    const [localDesc, setLocalDesc] = useState(cap.description ?? '');
    const isExpanded = expanded.has(cap.id);
    const hasChildren = (cap.children?.length ?? 0) > 0;
    const isSaving = saving === cap.id;

    const indent = depth === 0 ? '' : depth === 1 ? 'ml-6' : 'ml-12';
    const bg = depth === 0 ? 'bg-white border-gray-200' : depth === 1 ? 'bg-gray-50 border-gray-100' : 'bg-gray-100/50 border-gray-100';

    return (
      <div className={`${indent} mb-2`}>
        <div className={`border rounded-lg p-3 ${bg} transition-shadow hover:shadow-sm`}>
          <div className="flex items-start gap-2">
            {hasChildren ? (
              <button onClick={() => toggleExpand(cap.id)} className="mt-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : <div className="w-4 flex-shrink-0" />}

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400">L{cap.level}</span>
                {canEdit ? (
                  <input value={localName} onChange={e => setLocalName(e.target.value)}
                    onBlur={() => { if (localName !== cap.name) updateCapability(cap.id, 'name', localName); }}
                    className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none min-w-0" />
                ) : (
                  <span className="text-sm font-medium text-gray-900">{cap.name}</span>
                )}
                {canEdit && (
                  <select value={cap.strategic_importance}
                    onChange={e => updateCapability(cap.id, 'strategic_importance', e.target.value)}
                    className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white">
                    {IMPORTANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                <span className={`text-xs px-1.5 py-0.5 rounded ${IMPORTANCE_COLORS[cap.strategic_importance]}`}>
                  {cap.strategic_importance}
                </span>
                {canEdit && (
                  <button onClick={() => updateCapability(cap.id, 'is_ai_priority', !cap.is_ai_priority)}
                    title="Toggle AI Priority"
                    className={`flex items-center gap-0.5 ${cap.is_ai_priority ? 'text-yellow-600' : 'text-gray-300'}`}>
                    <Star className="h-3.5 w-3.5" fill={cap.is_ai_priority ? 'currentColor' : 'none'} />
                    <span className="hidden sm:inline text-xs">AI</span>
                  </button>
                )}
                {isSaving && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
              </div>
              {canEdit ? (
                <input value={localDesc} placeholder="Add description…"
                  onChange={e => setLocalDesc(e.target.value)}
                  onBlur={() => { if (localDesc !== (cap.description ?? '')) updateCapability(cap.id, 'description', localDesc); }}
                  className="w-full text-xs text-gray-500 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-300 focus:outline-none" />
              ) : (
                cap.description && <p className="text-xs text-gray-500">{cap.description}</p>
              )}
            </div>

            {canEdit && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                {cap.level < 3 && (
                  <button onClick={() => addCapability(cap.level + 1, cap.id)}
                    title={`Add L${cap.level + 1} sub-capability`}
                    className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => deleteCapability(cap.id)}
                  className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
        {isExpanded && cap.children?.map(child => <CapRow key={child.id} cap={child} depth={depth + 1} />)}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading capabilities…</span>
      </div>
    );
  }

  const hasCaps = l1Caps.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Business Capabilities</h1>
          <p className="text-gray-500 text-sm">Map your organisation's capabilities at L1 · L2 · L3 levels</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Upload className="h-4 w-4" />
              Import file
            </button>
            <button onClick={() => setShowAIGen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-purple-200 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </button>
            {hasCaps && (
              <button onClick={() => setShowMapper(true)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                  mappingCount > 0
                    ? 'border border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}>
                <Network className="h-4 w-4" />
                {mappingCount > 0 ? `View Mappings (${mappingCount})` : 'Map to assets'}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      {/* Organisation context */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Organisation context</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mission / vision statement</label>
            <textarea value={mission} onChange={e => setMission(e.target.value)} readOnly={!canEdit} rows={3}
              placeholder="Enter the organisation's mission or vision…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none read-only:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Strategic goals</label>
            <textarea value={goals} onChange={e => setGoals(e.target.value)} readOnly={!canEdit} rows={3}
              placeholder="Key strategic goals and priorities…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:outline-none read-only:bg-gray-50" />
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3 mt-3">
            <button onClick={saveMissionGoals}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
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
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" fill="currentColor" /> AI priority</span>
        <span>L1 = Domain · L2 = Sub-domain · L3 = Process</span>
      </div>

      {/* Capability tree */}
      {!hasCaps ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
          <Network className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No capabilities defined yet</p>
          <p className="text-xs text-gray-400 mb-5">Import a file, generate with AI, or add capabilities manually.</p>
          {canEdit && (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                <Upload className="h-4 w-4" /> Import file
              </button>
              <button onClick={() => setShowAIGen(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Sparkles className="h-4 w-4" /> Generate with AI
              </button>
              <button onClick={() => addCapability(1, null)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="h-4 w-4" /> Add manually
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4">
          {l1Caps.map(cap => <CapRow key={cap.id} cap={cap} depth={0} />)}
        </div>
      )}

      {canEdit && hasCaps && (
        <button onClick={() => addCapability(1, null)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 rounded-lg px-4 py-2 w-full justify-center hover:bg-blue-50 transition-colors mt-2">
          <Plus className="h-4 w-4" />
          Add L1 capability
        </button>
      )}

      {/* Modals */}
      {showImport && orgId && user?.id && (
        <FileImportModal orgId={orgId} userId={user.id}
          onSuccess={() => { setShowImport(false); loadData(); }}
          onClose={() => setShowImport(false)} />
      )}
      {showAIGen && orgId && user?.id && (
        <AIGeneratorModal orgId={orgId} userId={user.id} mission={mission} goals={goals}
          onSuccess={() => { setShowAIGen(false); loadData(); }}
          onClose={() => setShowAIGen(false)} />
      )}
      {showMapper && orgId && user?.id && (
        <AssetMapperModal orgId={orgId} userId={user.id} capabilities={l1Caps}
          onClose={() => { setShowMapper(false); loadData(); }} />
      )}
    </div>
  );
};

export default CapabilityMapper;
