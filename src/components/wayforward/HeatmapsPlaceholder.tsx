import React from 'react';
import { Lock, LayoutGrid } from 'lucide-react';

const HeatmapsPlaceholder: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
    <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-5">
      <Lock className="h-7 w-7 text-green-400" />
    </div>
    <LayoutGrid className="h-8 w-8 text-green-500 mx-auto mb-3" />
    <h2 className="text-xl font-bold text-gray-900 mb-2">Portfolio Heatmaps</h2>
    <p className="text-gray-500 mb-8 max-w-md mx-auto">
      Visual matrix of business capabilities versus asset health scores — makes redundancies, gaps,
      and coverage problems immediately visible.
    </p>

    {/* Mock heatmap preview */}
    <div className="grid grid-cols-5 gap-1 max-w-xs mx-auto mb-8 opacity-40">
      {Array.from({ length: 20 }).map((_, i) => {
        const heat = Math.random();
        const bg = heat > 0.7 ? 'bg-red-400' : heat > 0.4 ? 'bg-yellow-400' : 'bg-green-400';
        return <div key={i} className={`h-8 rounded ${bg}`} />;
      })}
    </div>

    <div className="grid grid-cols-3 gap-3 text-left mb-6 max-w-sm mx-auto">
      {[
        { color: 'bg-red-400', label: 'Over-served / redundant' },
        { color: 'bg-yellow-400', label: 'Adequate coverage' },
        { color: 'bg-green-400', label: 'Under-served / gap' },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-2 text-xs text-gray-600">
          <div className={`w-4 h-4 rounded ${item.color} flex-shrink-0`} />
          {item.label}
        </div>
      ))}
    </div>

    <p className="text-sm text-gray-400">
      Available after Phase 2 · Portfolio Intelligence is complete and validated.
    </p>
  </div>
);

export default HeatmapsPlaceholder;
