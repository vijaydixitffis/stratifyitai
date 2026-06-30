import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronDown, Plus, Building, Bell } from 'lucide-react';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import { Organization } from '../services/organizationService';

type HeaderProps = {
  onShowOnboardOrg?: () => void;
  orgs: Organization[];
  reloadOrgs: () => Promise<void>;
};

const Header: React.FC<HeaderProps> = ({ onShowOnboardOrg, orgs }) => {
  const { user, logout, isAdmin } = useAuth();
  const { selectedOrg, setSelectedOrg } = useSelectedOrg();

  const sortedOrgs = [...orgs].sort((a, b) => a.org_name.localeCompare(b.org_name));

  useEffect(() => {
    if (!user) {
      setSelectedOrg(null);
    } else if (user && isAdmin && (user as any).orgCode === 'ADMIN' && selectedOrg && !orgs.find(o => o.org_id === selectedOrg.org_id)) {
      setSelectedOrg(null);
    }
  }, [user, setSelectedOrg, orgs, selectedOrg, isAdmin]);

  const nameStr: string = (user as any)?.name ?? '';
  const initials = nameStr ? nameStr.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  // Org display for non-admin users — fall back to orgCode when org name not yet resolved
  const clientOrgName = (user as any)?.organization || (user as any)?.orgCode || '';
  const clientOrgInitial = clientOrgName?.[0]?.toUpperCase() ?? '?';

  return (
    <header style={{ background: 'var(--ink)', color: '#fff', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Left: Logo + separator + Platform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="7" fill="#1a6fb5" />
              <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white" />
              <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity=".7" />
              <rect x="6" y="20" width="9" height="3" rx="1.5" fill="white" opacity=".4" />
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#ffffff', letterSpacing: '-.01em' }}>
              StratifyIT<span style={{ color: '#2f8fdb' }}>.ai</span>
            </span>
          </div>
          <span style={{ width: 1, height: 22, background: 'var(--border-dark)', display: 'inline-block' }} />
          <span style={{ font: 'var(--t-small)', color: 'var(--fgd-3)' }}>Platform</span>
        </div>

        {/* Right: Org switcher + bell + user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

          {/* Admin org switcher */}
          {user && isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                {/* Visual pill */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  background: 'var(--ink-2)', border: '1px solid var(--border-dark)',
                  borderRadius: 999, padding: '6px 14px 6px 8px', color: '#fff',
                  pointerEvents: 'none',
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: selectedOrg ? 'linear-gradient(150deg,#2f8fdb,#145a93)' : 'var(--border-dark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-display)',
                  }}>
                    {selectedOrg ? selectedOrg.org_name[0].toUpperCase() : '?'}
                  </span>
                  <span style={{ font: 'var(--t-small)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {selectedOrg ? selectedOrg.org_name : 'Select client…'}
                  </span>
                  <ChevronDown size={14} style={{ color: 'var(--fgd-3)' }} />
                </div>
                {/* Native select overlaid for interaction */}
                <select
                  value={selectedOrg?.org_id || ''}
                  onChange={e => {
                    if (e.target.value === '') {
                      setSelectedOrg(null);
                    } else {
                      const org = sortedOrgs.find(o => o.org_id === Number(e.target.value));
                      if (org) setSelectedOrg(org);
                    }
                  }}
                  style={{
                    position: 'absolute', inset: 0, opacity: 0,
                    cursor: 'pointer', width: '100%', border: 'none',
                  }}
                >
                  <option value="">Select client…</option>
                  {sortedOrgs.map(org => (
                    <option key={org.org_id} value={org.org_id}>
                      {org.org_name} ({org.org_code})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={onShowOnboardOrg}
                title="Onboard new client"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '7px 11px', borderRadius: 8,
                  background: 'var(--sky)', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <Building size={13} />
              </button>
            </div>
          )}

          {/* Non-admin org pill (static) */}
          {user && !isAdmin && clientOrgName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              background: 'var(--ink-2)', border: '1px solid var(--border-dark)',
              borderRadius: 999, padding: '6px 14px 6px 8px', color: '#fff',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: 'linear-gradient(150deg,#2f8fdb,#145a93)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-display)',
              }}>
                {clientOrgInitial}
              </span>
              <span style={{ font: 'var(--t-small)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {clientOrgName}
              </span>
            </div>
          )}

          {/* Bell */}
          {user && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="var(--fgd-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ cursor: 'pointer', flexShrink: 0 }}>
              <path d="M10.268 21a2 2 0 0 0 3.464 0" />
              <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
            </svg>
          )}

          {/* User cluster (click to logout) */}
          {user && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
              onClick={logout}
              title="Sign out"
            >
              <span style={{
                width: 30, height: 30, borderRadius: '50%', background: 'var(--sky)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-display)', flexShrink: 0,
              }}>
                {initials}
              </span>
              <div className="hidden sm:block" style={{ lineHeight: 1.1 }}>
                <div style={{ font: 'var(--t-small)', fontWeight: 600 }}>{nameStr}</div>
                <div style={{ fontSize: 11, color: 'var(--fgd-3)', textTransform: 'capitalize' }}>
                  {((user as any).role ?? '').replace(/-/g, ' ')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
