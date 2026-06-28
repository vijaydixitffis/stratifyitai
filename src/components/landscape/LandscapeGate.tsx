import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAssets } from '../../contexts/AssetContext';
import { usePhase } from '../../contexts/PhaseContext';
import { useSelectedOrg } from '../../contexts/SelectedOrgContext';
import { CheckCircle, Circle, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';

const LandscapeGate: React.FC = () => {
  const { isAdmin } = useAuth();
  const { assets } = useAssets();
  const { currentPhase, advancePhase } = usePhase();
  const { selectedOrg } = useSelectedOrg();
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!isAdmin) return null;
  if (currentPhase !== 1) return null;

  const assetCount = assets.length;
  const activeCount = assets.filter(a => a.status === 'active').length;

  const streams = [
    {
      label: 'Asset Inventory',
      detail: `${assetCount} assets ingested · ${activeCount} active`,
      ready: assetCount >= 1,
    },
    {
      label: 'Business Capabilities',
      detail: 'Capability model defined by client',
      ready: false, // Will query DB in future iteration
    },
    {
      label: 'Readiness Assessments',
      detail: 'AI Readiness · App Modernization · Database Architecture',
      ready: false, // Will query assessment_sessions in future iteration
    },
  ];

  const handleAdvance = async () => {
    setError(null);
    setAdvancing(true);
    try {
      await advancePhase();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to advance phase');
    } finally {
      setAdvancing(false);
    }
  };

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle className="h-5 w-5" />
          <span className="font-semibold">Phase 1 approved — Portfolio Intelligence is now unlocked!</span>
        </div>
        <p className="text-sm text-green-700 mt-2">
          Reload the page or navigate to Portfolio Intelligence to begin AI analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
        Phase 1 gate — readiness for Portfolio Intelligence
      </h3>

      <div className="space-y-3 mb-5">
        {streams.map((stream, i) => (
          <div key={i} className="flex items-start gap-3">
            {stream.ready
              ? <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              : <Circle className="h-5 w-5 text-gray-300 mt-0.5 flex-shrink-0" />}
            <div>
              <p className="text-sm font-medium text-gray-800">{stream.label}</p>
              <p className="text-xs text-gray-500">{stream.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleAdvance}
        disabled={advancing}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {advancing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Approve &amp; advance to Portfolio Intelligence
      </button>
      <p className="text-xs text-gray-400 mt-2">
        Only admin architects can advance the phase. This action is recorded with your user ID and timestamp.
      </p>
    </div>
  );
};

export default LandscapeGate;
