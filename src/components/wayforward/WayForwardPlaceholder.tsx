import React from 'react';
import { usePhase } from '../../contexts/PhaseContext';
import { useAssets } from '../../contexts/AssetContext';
import { Lock, Trophy, LayoutGrid, GitBranch, ChevronRight } from 'lucide-react';

interface Props {
  onNavigate: (tab: string, subTab: string) => void;
}

const WayForwardPlaceholder: React.FC<Props> = ({ onNavigate }) => {
  const { currentPhase } = usePhase();
  const waitingForPhase2 = currentPhase < 2;

  const features = [
    {
      icon: Trophy,
      title: 'Scorecards',
      description:
        'Per-asset rationalization scorecards with 6R dispositions: Retain, Retire, Rehost, Replatform, Refactor, or Replace.',
    },
    {
      icon: LayoutGrid,
      title: 'Portfolio Heatmaps',
      description:
        'Visual matrix of business capabilities vs asset scores — highlights coverage gaps and redundancies.',
    },
    {
      icon: GitBranch,
      title: 'Roadmap',
      description:
        'Technology roadmap with short-term (0–6 mo), mid-term (6–18 mo), and long-term (18–36 mo) strategic initiatives.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
        <Lock className="h-8 w-8 text-green-500" />
      </div>
      <div className="text-3xl mb-2">🚀</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">The Way Forward</h1>
      <p className="text-gray-500 mb-8 max-w-lg mx-auto">
        {waitingForPhase2
          ? 'Available after Phase 1 · Know your Landscape is approved and Phase 2 · Portfolio Intelligence is completed.'
          : 'Available after Phase 2 · Portfolio Intelligence is complete and validated.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 text-left">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-xl p-5">
            <Icon className="h-6 w-6 text-green-500 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 max-w-md mx-auto">
        {waitingForPhase2
          ? 'Waiting for Phase 1 · Know your Landscape to be approved first'
          : 'Waiting for Phase 2 · Portfolio Intelligence to be completed and approved'}
      </div>

      <button
        onClick={() => onNavigate(waitingForPhase2 ? 'landscape' : 'intelligence', waitingForPhase2 ? 'assets' : 'analysis')}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        {waitingForPhase2 ? 'Go to Know your Landscape' : 'Go to Portfolio Intelligence'}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export default WayForwardPlaceholder;
