import React, { useState, useEffect, useCallback } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import {
  Plus,
  Upload,
  Search,
  Edit,
  Trash2,
  Database,
  Server,
  Cloud,
  Settings,
  Globe,
  Package,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Brain,
} from 'lucide-react';
import AssetForm from './AssetForm';
import AssetUpload from './AssetUpload';
import AssetReviewPanel from './AssetReviewPanel';
import { isSupabaseConfigured } from '../lib/supabase';
import { AssetReviewService, getPortfolioReviewSummary, runRationalization, type PortfolioReviewSummary } from '../services/assetReviewService';
import type { AssetReview } from '../types/assetReview';

const REVIEW_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  questionnaire_pending:   { label: 'Questionnaire Ready', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  questionnaire_assigned:  { label: 'Pending Response',    cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
  questionnaire_completed: { label: 'Answers In',          cls: 'bg-purple-100 text-purple-700 border border-purple-200' },
  addressed:               { label: 'Reviewed',            cls: 'bg-green-100 text-green-700 border border-green-200' },
};

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
  const { user, canEnrich, canRationalize } = useAuth();
  const { selectedOrg } = useSelectedOrg();

  const orgId: number = (user?.role?.startsWith('admin') && selectedOrg)
    ? selectedOrg.org_id
    : (user?.org_id ?? 0);
  const orgCode: string = (user?.role?.startsWith('admin') && selectedOrg)
    ? selectedOrg.org_code
    : (user?.orgCode ?? '');

  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [viewingAsset, setViewingAsset] = useState<any>(null);
  const [reviewingAsset, setReviewingAsset] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Review status map: assetId → AssetReview
  const [reviewMap, setReviewMap] = useState<Map<string, AssetReview>>(new Map());
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioReviewSummary | null>(null);
  const [rationalizationRunning, setRationalizationRunning] = useState(false);
  const [showRationalizationConfirm, setShowRationalizationConfirm] = useState(false);

  const loadReviewData = useCallback(async () => {
    if (!orgId) return;
    try {
      const reviews = await AssetReviewService.getReviewsForOrg(orgId);
      const map = new Map<string, AssetReview>();
      for (const r of reviews) map.set(r.asset_id, r);
      setReviewMap(map);
      const summary = await getPortfolioReviewSummary(orgId, assets.length);
      setPortfolioSummary(summary);
    } catch { /* non-fatal */ }
  }, [orgId, assets.length]);

  useEffect(() => { loadReviewData(); }, [loadReviewData]);

  const handleRunRationalization = async () => {
    setRationalizationRunning(true);
    setShowRationalizationConfirm(false);
    try {
      await runRationalization(orgId, orgCode);
    } catch (e) {
      console.error('Rationalization trigger failed:', e);
    } finally {
      setRationalizationRunning(false);
    }
  };

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

  // Pagination logic
  const totalPages = Math.ceil(assets.length / itemsPerPage);
  const paginatedAssets = assets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (size: number) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType]);

  // Truncate function for asset names
  const truncateName = (name: string, maxLength: number = 30) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Asset Inventory</h1>
            <p className="mt-2 text-gray-600">
              Manage your IT assets, upload inventories, and track portfolio status
            </p>
          </div>
          
          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-2">
            {isSupabaseConfigured() ? (
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Connected to Database</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full">
                <WifiOff className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Using Mock Data</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supabase Configuration Warning */}
      {!isSupabaseConfigured() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">Database Not Connected</h3>
              <p className="text-sm text-amber-700 mt-1">
                You're currently viewing mock data. To connect to your Supabase database:
              </p>
              <ol className="text-sm text-amber-700 mt-2 ml-4 list-decimal space-y-1">
                <li>Go to your Supabase dashboard for project "STRATIFYDB"</li>
                <li>Navigate to Settings → API</li>
                <li>Copy your Project URL and anon/public key</li>
                <li>Update the .env file with your credentials</li>
                <li>Restart the development server</li>
              </ol>
            </div>
          </div>
        </div>
      )}

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

      {/* Portfolio Review Progress Banner (admin + architect only) */}
      {canEnrich && portfolioSummary && portfolioSummary.total > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm font-semibold text-gray-800">Asset Review Progress</span>
              <span className="ml-2 text-sm text-gray-500">
                {portfolioSummary.addressed} of {portfolioSummary.total} assets reviewed ({portfolioSummary.readinessPercent}%)
              </span>
            </div>
            {canRationalize && (
              <button
                onClick={() => setShowRationalizationConfirm(true)}
                disabled={!portfolioSummary.canRunRationalization || rationalizationRunning}
                title={!portfolioSummary.canRunRationalization ? 'No assets reviewed yet' : undefined}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Brain className="h-4 w-4" />
                {rationalizationRunning ? 'Running...' : 'Run Rationalization'}
              </button>
            )}
          </div>
          {/* Segmented progress bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
            {portfolioSummary.addressed > 0 && (
              <div
                className="h-2 bg-green-500 transition-all"
                style={{ width: `${(portfolioSummary.addressed / portfolioSummary.total) * 100}%` }}
              />
            )}
            {portfolioSummary.questionnaire > 0 && (
              <div
                className="h-2 bg-yellow-400 transition-all"
                style={{ width: `${(portfolioSummary.questionnaire / portfolioSummary.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Reviewed: {portfolioSummary.addressed}</span>
            {portfolioSummary.questionnaire > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Questionnaire: {portfolioSummary.questionnaire}</span>}
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />Not started: {portfolioSummary.pending}</span>
          </div>
        </div>
      )}

      {/* Rationalization confirm modal */}
      {showRationalizationConfirm && portfolioSummary && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Run Portfolio Rationalization?</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{portfolioSummary.addressed}</strong> of <strong>{portfolioSummary.total}</strong> assets have completed AI reviews.
            </p>
            {portfolioSummary.pending > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                {portfolioSummary.pending} asset{portfolioSummary.pending > 1 ? 's are' : ' is'} not yet reviewed.
                Rationalization will run on available data only.
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleRunRationalization}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Run Anyway
              </button>
              <button
                onClick={() => setShowRationalizationConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
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
        {paginatedAssets.map((asset) => (
          <div 
            key={asset.id} 
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleView(asset)}
          >
            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-start mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                {getAssetIcon(asset.type)}
              </div>
              <div className="min-w-0 overflow-hidden">
                <h3 className="text-lg font-medium text-gray-900 truncate" title={asset.name}>{truncateName(asset.name)}</h3>
                <p className="text-sm text-gray-500 capitalize truncate">{asset.type.replace('-', ' ')}</p>
                {/* Review status badge */}
                {(() => {
                  const rv = reviewMap.get(asset.id);
                  if (!rv) return null;
                  const badge = REVIEW_STATUS_BADGE[rv.review_status];
                  if (!badge) return null;
                  return (
                    <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                      {rv.review_status === 'addressed' && rv.completeness_score != null
                        ? ` ${rv.completeness_score.toFixed(0)}%` : ''}
                    </span>
                  );
                })()}
              </div>
              <div className="flex space-x-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setReviewingAsset(asset)}
                  className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                  title="AI Architectural Review"
                >
                  <Brain className="h-4 w-4" />
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
          {!isSupabaseConfigured() && (
            <p className="text-sm text-amber-600 mt-2">
              Connect to Supabase to see your database assets
            </p>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {assets.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            {[10, 20, 50].map((size) => (
              <button
                key={size}
                onClick={() => handleItemsPerPageChange(size)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  itemsPerPage === size
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
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

      {reviewingAsset && (
        <AssetReviewPanel
          asset={reviewingAsset}
          onClose={() => { setReviewingAsset(null); loadReviewData(); }}
        />
      )}

      {viewingAsset && (() => {
        const a = viewingAsset;
        const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
        const isEol = a.end_of_life_date && new Date(a.end_of_life_date) < new Date();
        const isEos = a.end_of_support_date && new Date(a.end_of_support_date) < new Date();
        const Field = ({ label, value }: { label: string; value?: React.ReactNode }) =>
          value ? (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <div className="text-sm text-gray-900">{value}</div>
            </div>
          ) : null;
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-xl text-blue-700">
                    {getAssetIcon(a.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-gray-900">{a.name}</h2>
                      {a.asset_tag && <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{a.asset_tag}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-gray-500 capitalize">{a.type.replace('-', ' ')}</span>
                      {a.environment && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full capitalize">{a.environment}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(a.status)}`}>{a.status}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCriticalityColor(a.criticality)}`}>{a.criticality} criticality</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewingAsset(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0">×</button>
              </div>

              <div className="p-6 space-y-6">
                {/* Description */}
                {a.description && (
                  <p className="text-sm text-gray-700 leading-relaxed">{a.description}</p>
                )}

                {/* Warnings */}
                {(isEol || isEos) && (
                  <div className="flex gap-3 flex-wrap">
                    {isEol && <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs font-medium text-red-700">⚠ End-of-Life reached {fmt(a.end_of_life_date)}</div>}
                    {isEos && <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-medium text-amber-700">⚠ End-of-Support reached {fmt(a.end_of_support_date)}</div>}
                  </div>
                )}

                {/* Vendor & Sourcing */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Vendor & Sourcing</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Vendor" value={a.vendor} />
                    <Field label="Sourcing Type" value={a.sourcing_type?.replace('_', ' ')} />
                    <Field label="Category" value={a.category} />
                    <Field label="Business Unit" value={a.business_unit} />
                    <Field label="Owner" value={a.owner} />
                    <Field label="Location" value={a.location ?? a.hostname} />
                  </div>
                </div>

                {/* Lifecycle */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Lifecycle</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Purchase Date" value={fmt(a.purchase_date)} />
                    <Field label="Last Reviewed" value={fmt(a.last_reviewed_date)} />
                    <Field label="End of Life" value={a.end_of_life_date ? <span className={isEol ? 'text-red-600 font-semibold' : ''}>{fmt(a.end_of_life_date)}</span> : null} />
                    <Field label="End of Support" value={a.end_of_support_date ? <span className={isEos ? 'text-amber-600 font-semibold' : ''}>{fmt(a.end_of_support_date)}</span> : null} />
                    <Field label="License Expiry" value={fmt(a.license_expiry_date)} />
                    <Field label="License Type" value={a.license_type} />
                  </div>
                </div>

                {/* Financial */}
                {a.annual_cost && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Financial</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <Field label="Annual Cost" value={`$${a.annual_cost.toLocaleString()}`} />
                      <Field label="Support Contract" value={a.support_contract_id} />
                    </div>
                  </div>
                )}

                {/* Compliance & Risk */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Compliance & Risk</h3>
                  <div className="space-y-3">
                    {a.data_classification && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Data Classification</p>
                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          a.data_classification === 'restricted' ? 'bg-red-50 text-red-700 border-red-200' :
                          a.data_classification === 'confidential' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          a.data_classification === 'internal' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>{a.data_classification}</span>
                      </div>
                    )}
                    {a.compliance_tags?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Compliance Frameworks</p>
                        <div className="flex flex-wrap gap-1.5">
                          {a.compliance_tags.map((t: string) => (
                            <span key={t} className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {a.criticality_justification && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Criticality Justification</p>
                        <p className="text-sm text-gray-700">{a.criticality_justification}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {a.tags?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {a.tags.map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                  <span>Created by: {a.createdBy}</span>
                  <span>Last updated: {a.lastUpdated ? new Date(a.lastUpdated).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AssetInventory;