import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AssetProvider } from './contexts/AssetContext';
import Header from './components/Header';
import Navigation from './components/Navigation';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import AssetInventory from './components/AssetInventory';
import AssessmentsDashboard from './components/AssessmentsDashboard';
import ClientManagement from './components/ClientManagement';
import { Loader2 } from 'lucide-react';
import { SelectedOrgProvider, useSelectedOrg } from './contexts/SelectedOrgContext';
import { OrganizationService, Organization } from './services/organizationService';

// Add prop types for ClientManagement
type ClientManagementProps = {
  showOnboardOrgForm: boolean;
  setShowOnboardOrgForm: (show: boolean) => void;
  onOrgOnboarded: (org: any, user: any) => void;
  orgOnboarded: { org: any, user: any } | null;
  orgs: Organization[];
  reloadOrgs: () => Promise<void>;
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { setSelectedOrg } = useSelectedOrg();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showOnboardOrgForm, setShowOnboardOrgForm] = useState(false);
  const [orgOnboarded, setOrgOnboarded] = useState<null | { org: any, user: any }>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  // Load orgs on mount and when needed
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
  
  // Load organizations immediately when user logs in (especially for admins)
  useEffect(() => { 
    if (user) {
      reloadOrgs(); 
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // Handler for Onboard Org button: always go to clients tab and open modal
  const handleShowOnboardOrg = () => {
    setActiveTab('clients');
    setShowOnboardOrgForm(true);
  };

  // Handler to be called after org is onboarded
  const handleOrgOnboarded = async (org: any, user: any) => {
    await reloadOrgs();
    setSelectedOrg(org);
    setOrgOnboarded({ org, user });
    setShowOnboardOrgForm(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'assets':
        return <AssetInventory />;
      case 'assessments':
        return <AssessmentsDashboard />;
      case 'analytics':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Strategy Insights</h2>
              <p className="text-gray-600">Advanced strategic insights and analytics coming soon...</p>
            </div>
          </div>
        );
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
      case 'reports':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Reports</h2>
              <p className="text-gray-600">Advanced reporting features coming soon...</p>
            </div>
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
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onShowOnboardOrg={handleShowOnboardOrg} orgs={orgs} reloadOrgs={reloadOrgs} />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
        {renderContent()}
      </main>
      {/* Onboard Organization Modal is globally accessible */}
    </div>
  );
};

function App() {
  return (
    <SelectedOrgProvider>
      <AuthProvider>
        <AssetProvider>
          <AppContent />
        </AssetProvider>
      </AuthProvider>
    </SelectedOrgProvider>
  );
}

export default App;