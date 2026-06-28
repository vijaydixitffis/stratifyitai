import React from 'react';
import { Lock, Brain } from 'lucide-react';

const DIMENSIONS = [
  'Technical health', 'Business fit', 'Cloud readiness',
  'Security posture', 'AI readiness', 'Operational risk', 'Cost efficiency',
];

const AIAnalysisPlaceholder: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
    <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-full mb-5">
      <Lock className="h-7 w-7 text-purple-400" />
    </div>
    <Brain className="h-8 w-8 text-purple-500 mx-auto mb-3" />
    <h2 className="text-xl font-bold text-gray-900 mb-2">AI Analysis</h2>
    <p className="text-gray-500 mb-8 max-w-md mx-auto">
      Every asset will be scored by AI across 7 dimensions once Phase 1 is complete and approved.
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {DIMENSIONS.map(dim => (
        <div key={dim} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5 text-sm font-medium text-purple-700">
          {dim}
        </div>
      ))}
    </div>
    <p className="text-sm text-gray-400">
      Admin architects can override or annotate AI-generated scores with a rationale before publishing.
    </p>
  </div>
);

export default AIAnalysisPlaceholder;
