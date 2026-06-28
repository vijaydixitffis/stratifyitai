import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePhase } from '../contexts/PhaseContext';
import { Shield, User, LogOut, Plus, Building } from 'lucide-react';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import { Organization } from '../services/organizationService';

type HeaderProps = {
  onShowOnboardOrg?: () => void;
  orgs: Organization[];
  reloadOrgs: () => Promise<void>;
};

const PHASE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Phase 1 · Know your Landscape', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  2: { label: 'Phase 2 · Portfolio Intelligence', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  3: { label: 'Phase 3 · The Way Forward', color: 'bg-green-100 text-green-800 border-green-200' },
};

const Header: React.FC<HeaderProps> = ({ onShowOnboardOrg, orgs, reloadOrgs }) => {
  const { user, logout, isAdmin } = useAuth();
  const { selectedOrg, setSelectedOrg } = useSelectedOrg();
  const { currentPhase } = usePhase();

  const sortedOrgs = [...orgs].sort((a, b) => a.org_name.localeCompare(b.org_name));

  useEffect(() => {
    if (!user) {
      setSelectedOrg(null);
    } else if (user && isAdmin && user.orgCode === 'ADMIN' && selectedOrg && !orgs.find(o => o.org_id === selectedOrg.org_id)) {
      setSelectedOrg(null);
    }
  }, [user, setSelectedOrg, orgs, selectedOrg, isAdmin]);

  const phaseMeta = PHASE_LABELS[currentPhase] ?? PHASE_LABELS[1];

  // Show phase badge when an org is in context
  const showPhaseBadge = isAdmin ? !!selectedOrg : !!user?.org_id;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">StratifyIT.ai</span>
            {showPhaseBadge && (
              <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${phaseMeta.color}`}>
                {phaseMeta.label}
              </span>
            )}
          </div>

          {user && (
            <div className="flex items-center space-x-3">
              {isAdmin && (
                <>
                  <select
                    className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                    value={selectedOrg?.org_id || ''}
                    onChange={e => {
                      if (e.target.value === '') {
                        setSelectedOrg(null);
                      } else {
                        const org = sortedOrgs.find(o => o.org_id === Number(e.target.value));
                        if (org) setSelectedOrg(org);
                      }
                    }}
                  >
                    <option value="">-- Select Organization --</option>
                    {sortedOrgs.map(org => (
                      <option key={org.org_id} value={org.org_id}>
                        {org.org_name} ({org.org_code})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={onShowOnboardOrg}
                    title="Onboard Organization"
                    className="flex items-center justify-center bg-green-600 text-white p-2 rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <Building className="h-4 w-4 ml-0.5" />
                  </button>
                </>
              )}
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-400" />
                <div className="text-sm hidden sm:block">
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-gray-500 capitalize">{user.role.replace('-', ' ')}</p>
                </div>
              </div>
              <button onClick={logout} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
