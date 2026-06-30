import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePhase } from '../contexts/PhaseContext';
import { Lock } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  activeSubTab: string;
  onTabChange: (tab: string, subTab?: string) => void;
}

const PHASE_GROUPS = [
  { id: 'landscape',    label: 'Know your Landscape',    phase: 1 },
  { id: 'intelligence', label: 'Portfolio Intelligence', phase: 2 },
  { id: 'wayforward',   label: 'The Way Forward',        phase: 3 },
];

const SUB_TABS: Record<string, { id: string; label: string }[]> = {
  landscape: [
    { id: 'assets',       label: 'Asset Inventory' },
    { id: 'capabilities', label: 'Capabilities' },
    { id: 'readiness',    label: 'Readiness' },
  ],
  intelligence: [
    { id: 'analysis',        label: 'Strategy Insights' },
    { id: 'rationalization', label: 'Rationalisation' },
    { id: 'raids',           label: 'Risk Register' },
  ],
  wayforward: [
    { id: 'scorecards', label: 'Scorecards' },
    { id: 'heatmaps',   label: 'Heatmaps' },
    { id: 'roadmap',    label: 'Roadmap' },
  ],
};

const tabStyle = (active: boolean, locked = false): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '18px 14px',
  font: 'var(--t-small)',
  fontWeight: active ? 600 : 500,
  color: active ? 'var(--sky)' : locked ? 'var(--n-300)' : 'var(--fg-3)',
  background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--sky)' : 'transparent'}`,
  cursor: locked ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap', transition: 'color .15s, border-color .15s',
  opacity: locked ? 0.5 : 1,
});

const subTabStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 14px',
  font: 'var(--t-small)',
  fontWeight: active ? 600 : 500,
  color: active ? 'var(--sky)' : 'var(--fg-3)',
  background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--sky)' : 'transparent'}`,
  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .15s, border-color .15s',
});

// Inline SVG icons matching the design handoff
const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>
  </svg>
);

const IconLandscape = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/>
    <path d="M9 4v13M15 7v13"/>
  </svg>
);

const IconIntelligence = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
    <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/>
  </svg>
);

const IconWayForward = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
);

const IconClients = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const PHASE_ICONS: Record<string, React.FC> = {
  landscape:    IconLandscape,
  intelligence: IconIntelligence,
  wayforward:   IconWayForward,
};

const Navigation: React.FC<NavigationProps> = ({ activeTab, activeSubTab, onTabChange }) => {
  const { isAdmin } = useAuth();
  const { canAccessPhase } = usePhase();

  const isPhaseGroup = PHASE_GROUPS.some(g => g.id === activeTab);
  const activeGroup = PHASE_GROUPS.find(g => g.id === activeTab);

  return (
    <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', position: 'sticky', top: 60, zIndex: 30 }}>
      {/* Top-level tabs */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <button style={tabStyle(activeTab === 'dashboard')} onClick={() => onTabChange('dashboard')}>
            <IconDashboard />
            Dashboard
          </button>

          {PHASE_GROUPS.map(group => {
            const locked = !canAccessPhase(group.phase);
            const isActive = activeTab === group.id;
            const Icon = PHASE_ICONS[group.id];
            return (
              <div key={group.id} style={{ position: 'relative' }} className="group/nav">
                <button
                  style={tabStyle(isActive, locked)}
                  onClick={() => { if (!locked) onTabChange(group.id, SUB_TABS[group.id][0].id); }}
                  disabled={locked}
                  title={locked ? `Complete Phase ${group.phase - 1} to unlock` : undefined}
                >
                  <Icon />
                  {group.label}
                  {locked && <Lock style={{ width: 12, height: 12, marginLeft: 2 }} />}
                </button>
                {locked && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 20,
                    display: 'none', background: '#1a2735', color: '#fff',
                    fontSize: 12, borderRadius: 6, padding: '4px 10px',
                    whiteSpace: 'nowrap', marginTop: 4, pointerEvents: 'none',
                  }} className="group-hover/nav:block">
                    Complete Phase {group.phase - 1} to unlock
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Admin-only tabs on right */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button style={tabStyle(activeTab === 'clients')} onClick={() => onTabChange('clients')}>
              <IconClients />
              Clients
            </button>
          </div>
        )}
      </div>

      {/* Sub-navigation */}
      {isPhaseGroup && activeGroup && (
        <div style={{ background: 'var(--ghost-2)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 4 }}>
            {SUB_TABS[activeGroup.id].map(sub => (
              <button
                key={sub.id}
                style={subTabStyle(activeSubTab === sub.id)}
                onClick={() => onTabChange(activeGroup.id, sub.id)}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
