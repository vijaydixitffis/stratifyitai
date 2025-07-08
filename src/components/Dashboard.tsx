import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAssets } from '../contexts/AssetContext';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import { 
  BarChart3, 
  Database, 
  Server, 
  Cloud, 
  Shield, 
  TrendingUp,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Building,
  ArrowRight,
  Target,
  Zap
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, isClient, isAdmin } = useAuth();
  const { assets, loading } = useAssets();
  const { selectedOrg } = useSelectedOrg();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Show organization selection prompt for admins without selected org
  if (isAdmin && user?.orgCode === 'ADMIN' && !selectedOrg) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <Building className="mx-auto h-16 w-16 text-blue-600 mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to StratifyIT.ai Admin Dashboard
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Select an organization from the dropdown above to start managing their IT portfolio
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 mb-8">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Getting Started</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">Select Organization</h3>
                    <p className="text-sm text-blue-700">
                      Choose a client organization from the dropdown in the header to view their portfolio
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium text-green-900 mb-1">Manage Assets</h3>
                    <p className="text-sm text-green-700">
                      View, add, and manage IT assets for the selected organization
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-medium text-purple-900 mb-1">Run Assessments</h3>
                    <p className="text-sm text-purple-700">
                      Conduct portfolio analysis and generate strategic insights
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-medium text-orange-900 mb-1">Manage Users</h3>
                    <p className="text-sm text-orange-700">
                      Add and manage client users through the Client Management section
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <Target className="mx-auto h-8 w-8 text-blue-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-2">Portfolio Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Comprehensive IT portfolio assessment and strategic planning
                  </p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <Zap className="mx-auto h-8 w-8 text-green-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-2">Digital Transformation</h3>
                  <p className="text-sm text-gray-600">
                    Guide organizations through their digital transformation journey
                  </p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <Shield className="mx-auto h-8 w-8 text-purple-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-2">Risk Management</h3>
                  <p className="text-sm text-gray-600">
                    Identify and mitigate IT risks across the organization
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-center space-x-2 text-amber-800">
                <ArrowRight className="h-5 w-5" />
                <span className="font-medium">
                  Use the organization dropdown above to get started
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const assetStats = {
    total: assets.length,
    active: assets.filter(a => a.status === 'active').length,
    inactive: assets.filter(a => a.status === 'inactive').length,
    deprecated: assets.filter(a => a.status === 'deprecated').length,
    high: assets.filter(a => a.criticality === 'high').length,
    medium: assets.filter(a => a.criticality === 'medium').length,
    low: assets.filter(a => a.criticality === 'low').length
  };

  const assetTypeStats = {
    applications: assets.filter(a => a.type === 'application').length,
    databases: assets.filter(a => a.type === 'database').length,
    infrastructure: assets.filter(a => a.type === 'infrastructure').length,
    middleware: assets.filter(a => a.type === 'middleware').length,
    cloudServices: assets.filter(a => a.type === 'cloud-service').length,
    thirdParty: assets.filter(a => a.type === 'third-party-service').length
  };

  const StatCard: React.FC<{ 
    title: string; 
    value: number; 
    icon: React.ReactNode; 
    color: string;
    trend?: string;
  }> = ({ title, value, icon, color, trend }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className="text-sm text-green-600 mt-1">
              <TrendingUp className="h-4 w-4 inline mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        {selectedOrg && isAdmin && user?.orgCode === 'ADMIN' && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Building className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Managing: <span className="font-bold">{selectedOrg.org_name}</span>
                </p>
                <p className="text-xs text-blue-700">
                  Organization Code: {selectedOrg.org_code}
                </p>
              </div>
            </div>
          </div>
        )}
        <h1 className="text-3xl font-bold text-gray-900">
          {isAdmin && user?.orgCode === 'ADMIN' 
            ? `${selectedOrg?.org_name} Portfolio Dashboard`
            : `Welcome back, ${user?.name}`
          }
        </h1>
        <p className="mt-2 text-gray-600">
          {isAdmin && user?.orgCode === 'ADMIN'
            ? `IT portfolio overview and insights for ${selectedOrg?.org_name}`
            : `Here's your IT portfolio overview for ${user?.organization}`
          }
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Assets"
          value={assetStats.total}
          icon={<Database className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100"
          trend="+12% from last month"
        />
        <StatCard
          title="Active Assets"
          value={assetStats.active}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
        <StatCard
          title="High Criticality"
          value={assetStats.high}
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
          color="bg-red-100"
        />
        <StatCard
          title="Deprecated"
          value={assetStats.deprecated}
          icon={<Clock className="h-6 w-6 text-orange-600" />}
          color="bg-orange-100"
        />
      </div>

      {/* Asset Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Type Distribution</h3>
          <div className="space-y-3">
            {[
              { name: 'Applications', count: assetTypeStats.applications, color: 'bg-blue-500' },
              { name: 'Databases', count: assetTypeStats.databases, color: 'bg-green-500' },
              { name: 'Infrastructure', count: assetTypeStats.infrastructure, color: 'bg-purple-500' },
              { name: 'Middleware', count: assetTypeStats.middleware, color: 'bg-yellow-500' },
              { name: 'Cloud Services', count: assetTypeStats.cloudServices, color: 'bg-indigo-500' },
              { name: 'Third Party', count: assetTypeStats.thirdParty, color: 'bg-pink-500' }
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Status Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Active</span>
              </div>
              <span className="text-lg font-bold text-green-800">{assetStats.active}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-800">Inactive</span>
              </div>
              <span className="text-lg font-bold text-gray-800">{assetStats.inactive}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-800">Deprecated</span>
              </div>
              <span className="text-lg font-bold text-orange-800">{assetStats.deprecated}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left">
            <Database className="h-8 w-8 text-blue-600 mb-2" />
            <h4 className="font-medium text-gray-900">Manage Assets</h4>
            <p className="text-sm text-gray-600">View and edit asset inventory</p>
          </button>
          <button className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left">
            <BarChart3 className="h-8 w-8 text-green-600 mb-2" />
            <h4 className="font-medium text-gray-900">Strategy Insights</h4>
            <p className="text-sm text-gray-600">View portfolio insights</p>
          </button>
          <button className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left">
            <Shield className="h-8 w-8 text-purple-600 mb-2" />
            <h4 className="font-medium text-gray-900">Portfolio Analysis</h4>
            <p className="text-sm text-gray-600">Run portfolio assessments</p>
          </button>
          <button className="p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-left">
            <Cloud className="h-8 w-8 text-indigo-600 mb-2" />
            <h4 className="font-medium text-gray-900">Cloud Migration</h4>
            <p className="text-sm text-gray-600">Plan cloud strategy</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;