import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  Database, 
  BarChart3, 
  Shield, 
  Settings, 
  Users,
  Cloud,
  FileText
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { isClient, isAdmin } = useAuth();

  const clientTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'assets', label: 'Asset Inventory', icon: Database },
    { id: 'assessments', label: 'Assessments', icon: Shield },
    { id: 'analytics', label: 'Strategy Insights', icon: BarChart3 },
  ];

  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'assets', label: 'Asset Inventory', icon: Database },
    { id: 'assessments', label: 'Assessments', icon: Shield },
    { id: 'clients', label: 'Client Management', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'analytics', label: 'Strategy Insights', icon: BarChart3 },
  ];

  const tabs = isAdmin ? adminTabs : clientTabs;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;