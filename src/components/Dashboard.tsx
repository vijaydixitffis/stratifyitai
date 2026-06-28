import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAssets } from '../contexts/AssetContext';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import { usePhase } from '../contexts/PhaseContext';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Building,
  ArrowRight,
  Map,
  FlaskConical,
  Rocket,
  ChevronRight,
  TrendingUp,
  Server,
  Cloud,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string, subTab?: string) => void;
}

const PHASE_CONFIG = {
  1: {
    label: 'Know your Landscape',
    emoji: '🗺️',
    color: 'blue',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-900',
    subTextClass: 'text-blue-700',
    badgeClass: 'bg-blue-600',
    description: 'Ingest and validate all IT assets, map business capabilities, complete readiness assessments.',
    nextAction: {
      'client-manager': 'Upload your asset inventory to get started',
      'client-architect': 'Review assets and complete readiness assessments',
      'client-cxo': 'Review ingestion progress and approve capability model',
      admin: 'Monitor ingestion progress and validate data quality',
    },
    tab: 'landscape',
    subTab: 'assets',
  },
  2: {
    label: 'Portfolio Intelligence',
    emoji: '🔬',
    color: 'purple',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    textClass: 'text-purple-900',
    subTextClass: 'text-purple-700',
    badgeClass: 'bg-purple-600',
    description: 'AI-powered scoring of all assets across 7 dimensions, capability gap analysis, and risk mapping.',
    nextAction: {
      'client-manager': 'Review AI-generated asset scores and provide context',
      'client-architect': 'Flag assets for manual review and add technical context',
      'client-cxo': 'Review portfolio health dashboard and capability coverage',
      admin: 'Trigger AI analysis pipeline and validate score outputs',
    },
    tab: 'intelligence',
    subTab: 'analysis',
  },
  3: {
    label: 'The Way Forward',
    emoji: '🚀',
    color: 'green',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    textClass: 'text-green-900',
    subTextClass: 'text-green-700',
    badgeClass: 'bg-green-600',
    description: 'Asset scorecards with 6R dispositions, current/target architecture, technology roadmap.',
    nextAction: {
      'client-manager': 'Review asset scorecards and rationalization report',
      'client-architect': 'Validate current state architecture and provide technical feedback',
      'client-cxo': 'Review executive summary and approve technology roadmap',
      admin: 'Author 6R dispositions, architecture artifacts, and roadmap initiatives',
    },
    tab: 'wayforward',
    subTab: 'scorecards',
  },
} as const;

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, isClient, isAdmin } = useAuth();
  const { assets, loading } = useAssets();
  const { selectedOrg } = useSelectedOrg();
  const { currentPhase } = usePhase();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (isAdmin && user?.orgCode === 'ADMIN' && !selectedOrg) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16 max-w-2xl mx-auto">
          <Building className="mx-auto h-16 w-16 text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to StratifyIT.ai</h1>
          <p className="text-xl text-gray-600 mb-8">
            Select a client organization from the dropdown above to view their IT rationalization journey.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {([1, 2, 3] as const).map(phase => {
              const cfg = PHASE_CONFIG[phase];
              return (
                <div key={phase} className={`p-5 rounded-xl border ${cfg.borderClass} ${cfg.bgClass}`}>
                  <div className="text-2xl mb-2">{cfg.emoji}</div>
                  <h3 className={`font-semibold ${cfg.textClass} mb-1`}>Phase {phase}</h3>
                  <p className={`text-sm ${cfg.subTextClass}`}>{cfg.label}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-sm text-gray-500">
            Use the organization selector in the header to choose a client and begin.
          </p>
        </div>
      </div>
    );
  }

  const phase = currentPhase as 1 | 2 | 3;
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG[1];
  const roleKey = isAdmin ? 'admin' : (user?.role as keyof typeof cfg.nextAction) ?? 'client-manager';
  const nextActionText = cfg.nextAction[roleKey] ?? cfg.nextAction['client-manager'];

  const assetStats = {
    total: assets.length,
    active: assets.filter(a => a.status === 'active').length,
    inactive: assets.filter(a => a.status === 'inactive').length,
    deprecated: assets.filter(a => a.status === 'deprecated').length,
    high: assets.filter(a => a.criticality === 'high').length,
  };

  const orgName = isAdmin && selectedOrg
    ? selectedOrg.org_name
    : user?.organization ?? '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Phase journey banner */}
      <div className={`rounded-xl border ${cfg.borderClass} ${cfg.bgClass} p-6 mb-8`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{cfg.emoji}</span>
              <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.subTextClass}`}>
                Phase {currentPhase} of 3
              </span>
            </div>
            <h2 className={`text-xl font-bold ${cfg.textClass} mb-1`}>{cfg.label}</h2>
            <p className={`text-sm ${cfg.subTextClass} mb-3`}>{cfg.description}</p>
            <div className={`flex items-start gap-2 text-sm ${cfg.subTextClass}`}>
              <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span><strong>Your next action:</strong> {nextActionText}</span>
            </div>
          </div>
          <button
            onClick={() => onNavigate(cfg.tab, cfg.subTab)}
            className={`flex items-center gap-2 px-5 py-2.5 ${cfg.badgeClass} text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap self-start`}
          >
            Open {cfg.label}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Phase progress dots */}
        <div className="flex items-center gap-2 mt-5">
          {([1, 2, 3] as const).map(p => (
            <React.Fragment key={p}>
              <div className={`flex items-center gap-1.5 text-xs font-medium ${p <= currentPhase ? cfg.textClass : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${p < currentPhase ? cfg.badgeClass : p === currentPhase ? cfg.badgeClass : 'bg-gray-200'}`} />
                <span className="hidden sm:inline">{PHASE_CONFIG[p].label}</span>
                <span className="sm:hidden">P{p}</span>
              </div>
              {p < 3 && <div className={`flex-1 h-px max-w-[60px] ${p < currentPhase ? cfg.badgeClass : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Quick-navigate to phase sub-pages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => onNavigate('landscape', 'assets')}
          className="group bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <Database className="h-7 w-7 text-blue-500 mb-2" />
          <p className="font-medium text-gray-900 text-sm group-hover:text-blue-700">Asset Inventory</p>
          <p className="text-xs text-gray-500 mt-0.5">{assetStats.total} assets · {assetStats.active} active</p>
        </button>
        <button
          onClick={() => onNavigate('landscape', 'capabilities')}
          className="group bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <Server className="h-7 w-7 text-indigo-500 mb-2" />
          <p className="font-medium text-gray-900 text-sm group-hover:text-indigo-700">Capabilities</p>
          <p className="text-xs text-gray-500 mt-0.5">Map business capabilities</p>
        </button>
        <button
          onClick={() => onNavigate('landscape', 'readiness')}
          className="group bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <Cloud className="h-7 w-7 text-cyan-500 mb-2" />
          <p className="font-medium text-gray-900 text-sm group-hover:text-cyan-700">Readiness</p>
          <p className="text-xs text-gray-500 mt-0.5">AI & modernization assessments</p>
        </button>
      </div>

      {/* Asset stats (secondary) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Portfolio Snapshot</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { label: 'Total Assets', value: assetStats.total, icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active', value: assetStats.active, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'High Criticality', value: assetStats.high, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Deprecated', value: assetStats.deprecated, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
