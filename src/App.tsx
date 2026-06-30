import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AssetProvider } from './contexts/AssetContext';
import { PhaseProvider } from './contexts/PhaseContext';
import Header from './components/Header';
import Navigation from './components/Navigation';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import AssetInventory from './components/AssetInventory';
import AssessmentsDashboard from './components/AssessmentsDashboard';
import ClientManagement from './components/ClientManagement';
import LandscapeLanding from './components/landscape/LandscapeLanding';
import CapabilityMapper from './components/landscape/CapabilityMapper';
import LandscapeGate from './components/landscape/LandscapeGate';
import IntelligencePlaceholder from './components/intelligence/IntelligencePlaceholder';
import StrategyInsightsView from './components/intelligence/StrategyInsightsView';
import RationalizationTIMEView from './components/intelligence/RationalizationTIMEView';
import RiskRegisterView from './components/intelligence/RiskRegisterView';
import WayForwardPlaceholder from './components/wayforward/WayForwardPlaceholder';
import DispositionPanel from './components/wayforward/DispositionPanel';
import PortfolioHeatmapsView from './components/wayforward/PortfolioHeatmapsView';
import RoadmapKanban from './components/wayforward/RoadmapKanban';
import { Loader2 } from 'lucide-react';
import { SelectedOrgProvider, useSelectedOrg } from './contexts/SelectedOrgContext';
import { OrganizationService, Organization } from './services/organizationService';
import { usePhase } from './contexts/PhaseContext';

const AppContent: React.FC = () => {
  const { user, loading, isInitialized } = useAuth();
  const { setSelectedOrg } = useSelectedOrg();
  const { canAccessPhase } = usePhase();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('');
  const prevUserIdRef = useRef<string | undefined>(undefined);
  const [showOnboardOrgForm, setShowOnboardOrgForm] = useState(false);
  const [orgOnboarded, setOrgOnboarded] = useState<null | { org: any; user: any }>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  const reloadOrgs = async () => {
    setOrgsLoading(true);
    try {
      const orgList = await OrganizationService.getOrganizations();
      setOrgs(orgList);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setOrgsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isInitialized && (user.role === 'admin' || user.role === 'admin-super' || user.orgCode === 'ADMIN')) {
      reloadOrgs();
    } else if (!user && isInitialized) {
      setOrgs([]);
      setSelectedOrg(null);
    }
  }, [user, isInitialized]);

  // Reset to dashboard whenever a login occurs (user id changes from absent → present)
  useEffect(() => {
    if (user && user.id !== prevUserIdRef.current) {
      setActiveTab('dashboard');
      setActiveSubTab('');
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);

  if (!user && isInitialized) return <LoginForm />;

  if (loading || !isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  const handleTabChange = (tab: string, subTab?: string) => {
    setActiveTab(tab);
    setActiveSubTab(subTab ?? '');
  };

  const handleShowOnboardOrg = () => {
    setActiveTab('clients');
    setActiveSubTab('');
    setShowOnboardOrgForm(true);
  };

  const handleOrgOnboarded = async (org: any, user: any) => {
    await reloadOrgs();
    setSelectedOrg(org);
    setOrgOnboarded({ org, user });
    setShowOnboardOrgForm(false);
  };

  // ── Landscape (Phase 1) ──────────────────────────────────────────────────────
  const renderLandscapeContent = (sub: string) => {
    switch (sub) {
      case 'assets':       return <AssetInventory />;
      case 'capabilities': return <CapabilityMapper />;
      case 'readiness':    return <AssessmentsDashboard />;
      default:             return <LandscapeLanding onNavigate={handleTabChange} />;
    }
  };

  // ── Portfolio Intelligence (Phase 2) ─────────────────────────────────────────
  const renderIntelligenceContent = (sub: string) => {
    if (!canAccessPhase(2)) return <IntelligencePlaceholder onNavigate={handleTabChange} />;
    switch (sub) {
      case 'analysis':        return <StrategyInsightsView />;
      case 'rationalization': return <RationalizationTIMEView />;
      case 'raids':           return <RiskRegisterView />;
      default:                return <StrategyInsightsView />;
    }
  };

  // ── The Way Forward (Phase 3) ─────────────────────────────────────────────────
  const renderWayForwardContent = (sub: string) => {
    if (!canAccessPhase(3)) return <WayForwardPlaceholder onNavigate={handleTabChange} />;
    switch (sub) {
      case 'scorecards': return <DispositionPanel />;
      case 'heatmaps':   return <PortfolioHeatmapsView />;
      case 'roadmap':    return <RoadmapKanban />;
      default:           return <DispositionPanel />;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={handleTabChange} />;
      case 'landscape':
        return renderLandscapeContent(activeSubTab);
      case 'intelligence':
        return renderIntelligenceContent(activeSubTab);
      case 'wayforward':
        return renderWayForwardContent(activeSubTab);
      case 'clients':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <ClientManagement
              showOnboardOrgForm={showOnboardOrgForm}
              setShowOnboardOrgForm={setShowOnboardOrgForm}
              onOrgOnboarded={handleOrgOnboarded}
              orgOnboarded={orgOnboarded}
              orgs={orgs}
              reloadOrgs={reloadOrgs}
            />
          </div>
        );
      case 'settings':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
              <p className="text-gray-600">System settings and configuration coming soon...</p>
            </div>
          </div>
        );
      default:
        return <Dashboard onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onShowOnboardOrg={handleShowOnboardOrg} orgs={orgs} reloadOrgs={reloadOrgs} />
      <Navigation activeTab={activeTab} activeSubTab={activeSubTab} onTabChange={handleTabChange} />
      <main>{renderContent()}</main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SelectedOrgProvider>
        <AssetProvider>
          <PhaseProvider>
            <AppContent />
          </PhaseProvider>
        </AssetProvider>
      </SelectedOrgProvider>
    </AuthProvider>
  );
}

export default App;
