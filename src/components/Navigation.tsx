import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePhase } from '../contexts/PhaseContext';
import {
  Home,
  Map,
  FlaskConical,
  Rocket,
  Users,
  Settings,
  Lock,
  Database,
  Puzzle,
  ClipboardList,
  Brain,
  BarChart2,
  AlertTriangle,
  Trophy,
  LayoutGrid,
  GitBranch,
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  activeSubTab: string;
  onTabChange: (tab: string, subTab?: string) => void;
}

const PHASE_GROUPS = [
  { id: 'landscape', label: 'Know your Landscape', emoji: '🗺️', phase: 1 },
  { id: 'intelligence', label: 'Portfolio Intelligence', emoji: '🔬', phase: 2 },
  { id: 'wayforward', label: 'The Way Forward', emoji: '🚀', phase: 3 },
];

const SUB_TABS: Record<string, { id: string; label: string; icon: React.ComponentType<any> }[]> = {
  landscape: [
    { id: 'assets', label: 'Asset Inventory', icon: Database },
    { id: 'capabilities', label: 'Capabilities', icon: Puzzle },
    { id: 'readiness', label: 'Readiness', icon: ClipboardList },
  ],
  intelligence: [
    { id: 'analysis', label: 'AI Analysis', icon: Brain },
    { id: 'gaps', label: 'Gap Assessment', icon: BarChart2 },
    { id: 'raids', label: 'Risk Register / RAIDS', icon: AlertTriangle },
  ],
  wayforward: [
    { id: 'scorecards', label: 'Scorecards', icon: Trophy },
    { id: 'heatmaps', label: 'Portfolio Heatmaps', icon: LayoutGrid },
    { id: 'roadmap', label: 'Roadmap', icon: GitBranch },
  ],
};

const Navigation: React.FC<NavigationProps> = ({ activeTab, activeSubTab, onTabChange }) => {
  const { isAdmin } = useAuth();
  const { canAccessPhase } = usePhase();

  const isPhaseGroup = PHASE_GROUPS.some(g => g.id === activeTab);
  const activeGroup = PHASE_GROUPS.find(g => g.id === activeTab);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      {/* Top-level navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 overflow-x-auto">
            {/* Dashboard */}
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            {/* Phase group tabs */}
            {PHASE_GROUPS.map(group => {
              const locked = !canAccessPhase(group.phase);
              const isActive = activeTab === group.id;
              return (
                <div key={group.id} className="relative group/nav">
                  <button
                    onClick={() => {
                      if (!locked) onTabChange(group.id, SUB_TABS[group.id][0].id);
                    }}
                    disabled={locked}
                    title={locked ? `Complete Phase ${group.phase - 1} to unlock` : undefined}
                    className={`flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : locked
                        ? 'border-transparent text-gray-300 cursor-not-allowed opacity-60'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{group.emoji}</span>
                    <span>{group.label}</span>
                    {locked && <Lock className="h-3 w-3 ml-1 text-gray-400" />}
                  </button>
                  {locked && (
                    <div className="absolute top-full left-0 z-20 hidden group-hover/nav:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap mt-1 pointer-events-none">
                      Complete Phase {group.phase - 1} · {group.phase === 2 ? 'Know your Landscape' : 'Portfolio Intelligence'} to unlock
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Admin-only tabs on right */}
          {isAdmin && (
            <div className="flex space-x-1 flex-shrink-0 ml-4">
              <button
                onClick={() => onTabChange('clients')}
                className={`flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === 'clients'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Clients</span>
              </button>
              <button
                onClick={() => onTabChange('settings')}
                className={`flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-navigation bar (only when a phase group is active) */}
      {isPhaseGroup && activeGroup && (
        <div className="bg-gray-50 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 overflow-x-auto">
              {SUB_TABS[activeGroup.id].map(sub => {
                const SubIcon = sub.icon;
                const isActive = activeSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => onTabChange(activeGroup.id, sub.id)}
                    className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600 font-medium'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <SubIcon className="h-3.5 w-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
