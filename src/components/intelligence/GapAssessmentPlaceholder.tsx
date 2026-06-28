import React from 'react';
import { Lock, BarChart2 } from 'lucide-react';

const GapAssessmentPlaceholder: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
    <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-full mb-5">
      <Lock className="h-7 w-7 text-purple-400" />
    </div>
    <BarChart2 className="h-8 w-8 text-purple-500 mx-auto mb-3" />
    <h2 className="text-xl font-bold text-gray-900 mb-2">Gap Assessment</h2>
    <p className="text-gray-500 mb-8 max-w-md mx-auto">
      See which business capabilities are under-served, over-served, or missing assets entirely — available
      once Phase 1 is complete.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-6">
      {[
        { label: 'Under-served', desc: 'Capabilities with too few or weak assets to support them', color: 'bg-red-50 border-red-100 text-red-800' },
        { label: 'Over-served', desc: 'Redundant assets covering the same capability', color: 'bg-yellow-50 border-yellow-100 text-yellow-800' },
        { label: 'Gaps', desc: 'Business capabilities with no supporting IT assets at all', color: 'bg-orange-50 border-orange-100 text-orange-800' },
      ].map(item => (
        <div key={item.label} className={`border rounded-xl p-4 ${item.color}`}>
          <h4 className="font-semibold mb-1">{item.label}</h4>
          <p className="text-sm opacity-80">{item.desc}</p>
        </div>
      ))}
    </div>
    <p className="text-sm text-gray-400">
      Strategic importance tagging on capabilities feeds directly into gap severity scoring.
    </p>
  </div>
);

export default GapAssessmentPlaceholder;
