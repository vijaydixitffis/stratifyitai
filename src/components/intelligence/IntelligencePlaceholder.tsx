import React from 'react';
import { usePhase } from '../../contexts/PhaseContext';
import { useAssets } from '../../contexts/AssetContext';
import { Lock, Brain, BarChart2, AlertTriangle, ChevronRight } from 'lucide-react';

interface Props {
  onNavigate: (tab: string, subTab: string) => void;
}

const IntelligencePlaceholder: React.FC<Props> = ({ onNavigate }) => {
  const { currentPhase } = usePhase();
  const { assets } = useAssets();
  const assetCount = assets.length;
  const phase1Progress = assetCount > 0 ? Math.min(Math.round((assetCount / 50) * 100), 100) : 0;

  const features = [
    {
      icon: Brain,
      title: 'AI Analysis',
      description:
        'Every asset scored across 7 dimensions: technical health, business fit, cloud readiness, security, AI readiness, operational risk, and cost efficiency.',
    },
    {
      icon: BarChart2,
      title: 'Gap Assessment',
      description:
        'See which business capabilities are under-served, over-served, or missing assets entirely.',
    },
    {
      icon: AlertTriangle,
      title: 'Risk Register / RAIDS',
      description:
        'Structured log of risks, assumptions, issues, and dependencies across your portfolio.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6">
        <Lock className="h-8 w-8 text-purple-500" />
      </div>
      <div className="text-3xl mb-2">🔬</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Portfolio Intelligence</h1>
      <p className="text-gray-500 mb-8 max-w-lg mx-auto">
        This phase begins once <strong>Phase 1 · Know your Landscape</strong> is approved by your
        StratifyIT architect.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 text-left">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-xl p-5">
            <Icon className="h-6 w-6 text-purple-500 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        ))}
      </div>

      {/* Phase 1 status */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 text-left max-w-md mx-auto">
        <p className="text-sm font-semibold text-blue-900 mb-2">
          Phase 1 · Know your Landscape status
        </p>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${phase1Progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-blue-800">{phase1Progress}%</span>
        </div>
        <p className="text-xs text-blue-700">{assetCount} assets ingested</p>
      </div>

      <button
        onClick={() => onNavigate('landscape', 'assets')}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Know your Landscape
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export default IntelligencePlaceholder;
