import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, User, LogOut, Menu } from 'lucide-react';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import { useEffect, useState } from 'react';
import { OrganizationService, Organization } from '../services/organizationService';

const Header: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { selectedOrg, setSelectedOrg } = useSelectedOrg();
  const [orgs, setOrgs] = useState<Organization[]>([]);

  // Only load orgs if admin and ADMIN org
  useEffect(() => {
    if (user && isAdmin && user.orgCode === 'ADMIN') {
      OrganizationService.getOrganizations().then(setOrgs);
    }
  }, [user, isAdmin]);

  // Set default selected org to user's org on login
  useEffect(() => {
    if (user && isAdmin && user.orgCode === 'ADMIN' && orgs.length > 0 && !selectedOrg) {
      const defaultOrg = orgs.find(o => o.org_id === user.org_id) || orgs[0];
      setSelectedOrg(defaultOrg);
    }
  }, [user, isAdmin, orgs, selectedOrg, setSelectedOrg]);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-blue-600 mr-3" />
            <span className="text-xl font-bold text-gray-900">StratifyIT.ai</span>
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              {/* Org selector for ADMIN admins */}
              {isAdmin && user.orgCode === 'ADMIN' && (
                <select
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedOrg?.org_id || ''}
                  onChange={e => {
                    const org = orgs.find(o => o.org_id === Number(e.target.value));
                    if (org) setSelectedOrg(org);
                  }}
                >
                  {orgs.map(org => (
                    <option key={org.org_id} value={org.org_id}>
                      {org.org_name} ({org.org_code})
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-400" />
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-gray-500 capitalize">{user.role.replace('-', ' ')}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
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