import React, { useState } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Upload, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye,
  Database,
  Server,
  Cloud,
  Settings,
  Globe,
  Package,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import AssetForm from './AssetForm';
import AssetUpload from './AssetUpload';

const AssetInventory: React.FC = () => {
  const { 
    assets, 
    loading, 
    error, 
    deleteAsset, 
    searchQuery, 
    setSearchQuery, 
    selectedType, 
    setSelectedType,
    refreshAssets
  } = useAssets();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [viewingAsset, setViewingAsset] = useState<any>(null);

  const assetTypes = [
    { value: 'all', label: 'All Assets', icon: Package },
    { value: 'application', label: 'Applications', icon: Globe },
    { value: 'database', label: 'Databases', icon: Database },
    { value: 'infrastructure', label: 'Infrastructure', icon: Server },
    { value: 'middleware', label: 'Middleware', icon: Settings },
    { value: 'cloud-service', label: 'Cloud Services', icon: Cloud },
    { value: 'third-party-service', label: 'Third Party', icon: Package }
  ];

  const getAssetIcon = (type: string) => {
    const typeMap = {
      'application': Globe,
      'database': Database,
      'infrastructure': Server,
      'middleware': Settings,
      'cloud-service': Cloud,
      'third-party-service': Package
    };
    const Icon = typeMap[type as keyof typeof typeMap] || Package;
    return <Icon className="h-5 w-5" />;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      deprecated: 'bg-orange-100 text-orange-800',
      planned: 'bg-blue-100 text-blue-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getCriticalityColor = (criticality: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[criticality as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    setShowForm(true);
  };

  const handleView = (asset: any) => {
    setViewingAsset(asset);
  };

  const handleDelete = async (assetId: string) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      try {
        await deleteAsset(assetId);
      } catch (err) {
        console.error('Failed to delete asset:', err);
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAsset(null);
  };

  const handleRefresh = () => {
    refreshAssets();
  };

  if (loading && assets.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading assets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Asset Inventory</h1>
        <p className="mt-2 text-gray-600">
          Manage your IT assets, upload inventories, and track portfolio status
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-800">{error}</span>
            <button
              onClick={handleRefresh}
              className="ml-auto text-red-600 hover:text-red-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex space-x-3">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Spreadsheet
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          
          <div className="flex space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {assetTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {assets.map((asset) => (
          <div key={asset.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  {getAssetIcon(asset.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 truncate">{asset.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{asset.type.replace('-', ' ')}</p>
                </div>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleView(asset)}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEdit(asset)}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit Asset"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete Asset"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{asset.description}</p>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                  {asset.status}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticalityColor(asset.criticality)}`}>
                  {asset.criticality}
                </span>
              </div>
              <span className="text-gray-500">
                {asset.lastUpdated}
              </span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Owner:</span>
                <span className="font-medium text-gray-900">{asset.owner}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assets.length === 0 && !loading && (
        <div className="text-center py-12">
          <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
          <p className="text-gray-600">
            {searchQuery || selectedType !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first asset or uploading a spreadsheet'
            }
          </p>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <AssetForm
          asset={editingAsset}
          onClose={handleFormClose}
        />
      )}

      {showUpload && (
        <AssetUpload
          onClose={() => setShowUpload(false)}
        />
      )}

      {viewingAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    {getAssetIcon(viewingAsset.type)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{viewingAsset.name}</h2>
                    <p className="text-sm text-gray-500 capitalize">{viewingAsset.type.replace('-', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingAsset(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                  <p className="text-gray-900">{viewingAsset.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Category</h3>
                    <p className="text-gray-900">{viewingAsset.category}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Owner</h3>
                    <p className="text-gray-900">{viewingAsset.owner}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(viewingAsset.status)}`}>
                      {viewingAsset.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Criticality</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticalityColor(viewingAsset.criticality)}`}>
                      {viewingAsset.criticality}
                    </span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewingAsset.tags.map((tag: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Metadata</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                      {JSON.stringify(viewingAsset.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Created by: {viewingAsset.createdBy}</span>
                  <span>Last updated: {viewingAsset.lastUpdated}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetInventory;