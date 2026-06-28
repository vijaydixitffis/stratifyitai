import React from 'react';
import { Lock, Trophy } from 'lucide-react';

const SIX_R = ['Retain', 'Retire', 'Rehost', 'Replatform', 'Refactor', 'Replace'];
const COLORS = ['bg-green-100 text-green-700', 'bg-red-100 text-red-700', 'bg-blue-100 text-blue-700',
                 'bg-indigo-100 text-indigo-700', 'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700'];

const ScorecardsPlaceholder: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
    <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-5">
      <Lock className="h-7 w-7 text-green-400" />
    </div>
    <Trophy className="h-8 w-8 text-green-500 mx-auto mb-3" />
    <h2 className="text-xl font-bold text-gray-900 mb-2">Asset Scorecards</h2>
    <p className="text-gray-500 mb-8 max-w-md mx-auto">
      Per-asset rationalization scorecards with 6R dispositions — authored by StratifyIT architects
      and approved by the client CXO.
    </p>
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
      {SIX_R.map((r, i) => (
        <div key={r} className={`rounded-lg px-2 py-2.5 text-sm font-semibold ${COLORS[i]}`}>{r}</div>
      ))}
    </div>
    <p className="text-sm text-gray-400">
      Each scorecard includes AI-generated scores across 7 dimensions, a rationale narrative, risk
      flags, and the recommended disposition with justification.
    </p>
  </div>
);

export default ScorecardsPlaceholder;
