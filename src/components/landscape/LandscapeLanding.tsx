import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAssets } from '../../contexts/AssetContext';
import { usePhase } from '../../contexts/PhaseContext';
import { Database, Puzzle, ClipboardList, ChevronRight, CheckCircle } from 'lucide-react';
import LandscapeGate from './LandscapeGate';

interface LandscapeLandingProps {
  onNavigate: (tab: string, subTab: string) => void;
}

const LandscapeLanding: React.FC<LandscapeLandingProps> = ({ onNavigate }) => {
  const { user, isAdmin } = useAuth();
  const { assets } = useAssets();
  const { currentPhase } = usePhase();

  const assetCount = assets.length;
  const role = user?.role ?? 'client-manager';

  const subPages = [
    {
      id: 'assets',
      title: 'Asset Inventory',
      icon: Database,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      stat: `${assetCount} asset${assetCount !== 1 ? 's' : ''} ingested`,
      description: 'Upload and manage IT asset inventory via CSV or manual entry.',
    },
    {
      id: 'capabilities',
      title: 'Capabilities',
      icon: Puzzle,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-100',
      stat: 'Map L1 · L2 · L3 capabilities',
      description: 'Define business capabilities and link them to strategic priorities.',
    },
    {
      id: 'readiness',
      title: 'Readiness',
      icon: ClipboardList,
      iconColor: 'text-cyan-600',
      iconBg: 'bg-cyan-100',
      stat: 'AI Readiness · App Mod · Database',
      description: 'Complete modernization and AI readiness assessments per asset.',
    },
  ];

  const roleNextActions: Record<string, string[]> = {
    'client-manager': [
      'Upload your asset inventory (CSV or form)',
      'Fill in business capability questionnaire',
      'Assign readiness assessments to your architect',
    ],
    'client-architect': [
      'Complete application modernization assessment per asset',
      'Complete AI readiness assessment',
      'Tag assets with tech stack, integrations, and EOL dates',
    ],
    'client-cxo': [
      'Review ingestion progress and asset counts',
      'Approve capability model scope (L1–L3)',
    ],
    admin: [
      'Monitor overall ingestion progress across all streams',
      'Validate uploaded asset data for schema completeness',
      'Approve data quality before advancing to Phase 2',
    ],
  };

  const tasks = roleNextActions[role] ?? roleNextActions['client-manager'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🗺️</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Phase 1</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Know your Landscape</h1>
        <p className="text-gray-500 mt-1">
          Asset inventory · Business capabilities · AI readiness assessments
        </p>
      </div>

      {/* Sub-page cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {subPages.map(page => {
          const Icon = page.icon;
          return (
            <button
              key={page.id}
              onClick={() => onNavigate('landscape', page.id)}
              className="group bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${page.iconBg}`}>
                  <Icon className={`h-6 w-6 ${page.iconColor}`} />
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors mt-1" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">
                {page.title}
              </h3>
              <p className="text-xs text-gray-500 mb-2">{page.description}</p>
              <p className="text-xs font-medium text-blue-600">{page.stat}</p>
            </button>
          );
        })}
      </div>

      {/* Role-specific task list */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Your Phase 1 tasks</h3>
        <ul className="space-y-2">
          {tasks.map((task, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
              <CheckCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              {task}
            </li>
          ))}
        </ul>
      </div>

      {/* Phase gate — admin only */}
      {isAdmin && <LandscapeGate />}
    </div>
  );
};

export default LandscapeLanding;
