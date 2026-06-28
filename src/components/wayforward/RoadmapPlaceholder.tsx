import React from 'react';
import { Lock, GitBranch } from 'lucide-react';

const HORIZONS = [
  { label: 'Short-term', range: '0–6 months', color: 'bg-blue-50 border-blue-200 text-blue-800', desc: 'Quick wins, decommissions, immediate security patches' },
  { label: 'Mid-term', range: '6–18 months', color: 'bg-purple-50 border-purple-200 text-purple-800', desc: 'Platform migrations, rehosting, key modernization initiatives' },
  { label: 'Long-term', range: '18–36 months', color: 'bg-green-50 border-green-200 text-green-800', desc: 'Strategic refactors, AI integration, architecture transformation' },
];

const RoadmapPlaceholder: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
    <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-5">
      <Lock className="h-7 w-7 text-green-400" />
    </div>
    <GitBranch className="h-8 w-8 text-green-500 mx-auto mb-3" />
    <h2 className="text-xl font-bold text-gray-900 mb-2">Technology Roadmap</h2>
    <p className="text-gray-500 mb-8 max-w-md mx-auto">
      Three-horizon technology roadmap authored by StratifyIT architects and approved by the client
      CXO — available once Phase 2 is complete.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-6">
      {HORIZONS.map(h => (
        <div key={h.label} className={`border rounded-xl p-4 ${h.color}`}>
          <h4 className="font-bold mb-0.5">{h.label}</h4>
          <p className="text-xs font-medium mb-2 opacity-70">{h.range}</p>
          <p className="text-sm opacity-80">{h.desc}</p>
        </div>
      ))}
    </div>

    <p className="text-sm text-gray-400">
      Each initiative includes effort rating, business impact, affected assets, and milestone
      dependencies. CXO sign-off required before the roadmap is published.
    </p>
  </div>
);

export default RoadmapPlaceholder;
