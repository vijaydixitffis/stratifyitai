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
import { Loader2, AlertCircle } from 'lucide-react';
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
  const { user, loading, isInitialized } = useAuth();
  const { setSelectedOrg } = useSelectedOrg();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showOnboardOrgForm, setShowOnboardOrgForm] = useState(false);
  const [orgOnboarded, setOrgOnboarded] = useState<null | { org: any, user: any }>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [forceShowLogin, setForceShowLogin] = useState(false);

  // Debug logging for authentication state
  useEffect(() => {
    console.log('AppContent: Auth state changed -', {
      user: user?.id || 'none',
      loading,
      isInitialized,
      forceShowLogin,
      timestamp: new Date().toISOString()
    });
  }, [user, loading, isInitialized, forceShowLogin]);

  // Force show login after maximum timeout
  useEffect(() => {
    console.log('AppContent: Setting up maximum auth timeout (10s)');
    const maxTimeoutId = setTimeout(() => {
      console.warn('AppContent: Maximum auth timeout reached, forcing login display');
      console.warn('AppContent: Current auth state at timeout -', {
        user: user?.id || 'none',
        loading,
        isInitialized
      });
      setForceShowLogin(true);
    }, 10000); // Reduced to 10 seconds maximum timeout (matches faster auth context timeouts)

    return () => {
      console.log('AppContent: Cleaning up maximum auth timeout');
      clearTimeout(maxTimeoutId);
    };
  }, []);

  // Load orgs on mount and when needed
  const reloadOrgs = async () => {
    setOrgsLoading(true);
    setOrgsError(null);
    try {
      const orgList = await OrganizationService.getOrganizations();
      setOrgs(orgList);
    } catch (error) {
      console.error('Error loading organizations:', error);
      setOrgsError('Failed to load organizations. Please try refreshing the page.');
    } finally {
      setOrgsLoading(false);
    }
  };
  
  // Load organizations immediately when user logs in (especially for admins)
  useEffect(() => {
    if (user && isInitialized) {
      reloadOrgs();
    } else if (!user && isInitialized) {
      // Clear orgs when user logs out
      setOrgs([]);
      setSelectedOrg(null);
    }
  }, [user, isInitialized]);

  // Add initialization timeout as final safety net
  useEffect(() => {
    let initTimeoutId: NodeJS.Timeout;

    if (loading && !isInitialized) {
      console.log('AppContent: Setting up initialization timeout (5s) - auth still loading');
      initTimeoutId = setTimeout(() => {
        console.warn('AppContent: Auth initialization timeout reached, forcing completion');
        console.warn('AppContent: Current auth state at init timeout -', {
          user: user?.id || 'none',
          loading,
          isInitialized
        });
        // Only force completion if user is still not set
        if (!user) {
          console.warn('App timeout: Forcing app completion with no user');
          setAppError('Authentication is taking longer than expected. Please refresh the page if you continue to experience issues.');
        } else {
          console.log('App timeout: User already set, just waiting for initialization to complete');
          // Don't set loading/isInitialized from here - let auth context handle it
        }
      }, 5000); // Reduced to 5 seconds to match AuthContext timeouts
    }

    return () => {
      if (initTimeoutId) {
        console.log('AppContent: Cleaning up initialization timeout');
        clearTimeout(initTimeoutId);
      }
    };
  }, [loading, isInitialized, user]);

  // Show login form if no user and either initialized or force show
  if (!user && (isInitialized || forceShowLogin)) {
    console.log('AppContent: Showing login form -', {
      hasUser: !!user,
      isInitialized,
      forceShowLogin,
      reason: !user ? 'No user' : 'User exists'
    });
    return <LoginForm />;
  }

  // Show loading state with timeout error handling
  if (loading && !isInitialized) {
    console.log('AppContent: Showing loading state - auth still initializing');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading application...</p>
          {appError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md max-w-md mx-auto">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <p className="text-red-700 text-sm">{appError}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
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
      <Header onShowOnboardOrg={handleShowOnboardOrg} orgs={orgs} />
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
    <AuthProvider>
      <SelectedOrgProvider>
        <AssetProvider>
          <AppContent />
        </AssetProvider>
      </SelectedOrgProvider>
    </AuthProvider>
  );
}

export default App;