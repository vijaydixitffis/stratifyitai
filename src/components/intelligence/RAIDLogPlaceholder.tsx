import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';

const RAID = [
  { letter: 'R', label: 'Risks', desc: 'Threats to the portfolio transformation — probability and impact rated' },
  { letter: 'A', label: 'Assumptions', desc: 'Conditions assumed to hold true for the rationalization plan' },
  { letter: 'I', label: 'Issues', desc: 'Current problems blocking progress, with owners and target resolution' },
  { letter: 'D', label: 'Dependencies', desc: 'Cross-asset or cross-initiative dependencies that affect sequencing' },
];

const RAIDLogPlaceholder: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
    <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-full mb-5">
      <Lock className="h-7 w-7 text-purple-400" />
    </div>
    <AlertTriangle className="h-8 w-8 text-purple-500 mx-auto mb-3" />
    <h2 className="text-xl font-bold text-gray-900 mb-2">Risk Register / RAIDS</h2>
    <p className="text-gray-500 mb-8 max-w-md mx-auto">
      Structured log of portfolio-level risks, assumptions, issues, and dependencies — available once
      Phase 1 is complete.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
      {RAID.map(item => (
        <div key={item.letter} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0">
            {item.letter}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">{item.label}</h4>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default RAIDLogPlaceholder;
