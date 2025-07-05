import React, { useState, useEffect } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Trash2, ChevronRight, Lock } from 'lucide-react';

interface AssetFormProps {
  asset?: any;
  onClose: () => void;
}

interface MetadataEntry {
  key: string;
  value: string;
}

const AssetForm: React.FC<AssetFormProps> = ({ asset, onClose }) => {
  const { addAsset, updateAsset } = useAssets();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    category: '',
    description: '',
    owner: '',
    status: 'active',
    criticality: 'medium',
    tags: ''
  });
  
  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([
    { key: '', value: '' }
  ]);

  // Asset type categories mapping
  const assetCategories = {
    application: [
      'Web Application',
      'Mobile Application',
      'SaaS Product',
      'Legacy Application',
      'Mainframe Application',
      'Desktop Application',
      'API/Microservice',
      'Enterprise Application'
    ],
    database: [
      'RDBMS (MySQL/PostgreSQL)',
      'RDBMS (SQL Server)',
      'RDBMS (Oracle)',
      'NoSQL (MongoDB)',
      'NoSQL (Cassandra)',
      'NoSQL (Redis)',
      'Block Storage',
      'S3 Block Storage',
      'Data Warehouse',
      'Time Series Database'
    ],
    infrastructure: [
      'Physical Server',
      'Virtual Machine',
      'Container Platform',
      'Load Balancer',
      'Network Equipment',
      'Storage System',
      'Backup System',
      'Security Appliance'
    ],
    middleware: [
      'Application Server',
      'Message Queue',
      'API Gateway',
      'Service Bus',
      'Workflow Engine',
      'Integration Platform',
      'Cache Server',
      'Proxy Server'
    ],
    'cloud-service': [
      'AWS EC2',
      'AWS RDS',
      'AWS S3',
      'AWS Lambda',
      'Azure VM',
      'Azure SQL',
      'Azure Storage',
      'Google Cloud Compute',
      'Google Cloud Storage',
      'Kubernetes Service'
    ],
    'third-party-service': [
      'SaaS Platform',
      'Payment Gateway',
      'Authentication Service',
      'Monitoring Service',
      'Analytics Platform',
      'Communication Service',
      'Security Service',
      'Backup Service'
    ]
  };

  useEffect(() => {
    if (asset) {
      setFormData({
        name: asset.name,
        type: asset.type,
        category: asset.category,
        description: asset.description,
        owner: asset.owner,
        status: asset.status,
        criticality: asset.criticality,
        tags: asset.tags.join(', ')
      });

      // Convert metadata object to key-value pairs
      const entries = Object.entries(asset.metadata || {}).map(([key, value]) => ({
        key,
        value: String(value)
      }));
      setMetadataEntries(entries.length > 0 ? entries : [{ key: '', value: '' }]);
      
      // Skip to step 2 for editing existing assets
      setCurrentStep(2);
    }
  }, [asset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert metadata entries to object, filtering out empty entries
    const metadata = metadataEntries
      .filter(entry => entry.key.trim() !== '')
      .reduce((acc, entry) => {
        acc[entry.key.trim()] = entry.value.trim();
        return acc;
      }, {} as Record<string, string>);
    
    const assetData = {
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      metadata,
      createdBy: user?.email || 'unknown'
    };

    if (asset) {
      updateAsset(asset.id, assetData);
    } else {
      addAsset(assetData);
    }
    
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleTypeSelection = (type: string) => {
    setFormData({
      ...formData,
      type,
      category: '' // Reset category when type changes
    });
    setCurrentStep(2);
  };

  const handleCategorySelection = (category: string) => {
    setFormData({
      ...formData,
      category
    });
    setCurrentStep(3);
  };

  const handleMetadataChange = (index: number, field: 'key' | 'value', value: string) => {
    const newEntries = [...metadataEntries];
    newEntries[index][field] = value;
    setMetadataEntries(newEntries);
  };

  const addMetadataEntry = () => {
    setMetadataEntries([...metadataEntries, { key: '', value: '' }]);
  };

  const removeMetadataEntry = (index: number) => {
    if (metadataEntries.length > 1) {
      const newEntries = metadataEntries.filter((_, i) => i !== index);
      setMetadataEntries(newEntries);
    }
  };

  const getAssetTypeIcon = (type: string) => {
    const icons = {
      application: '🌐',
      database: '🗄️',
      infrastructure: '🖥️',
      middleware: '⚙️',
      'cloud-service': '☁️',
      'third-party-service': '🔗'
    };
    return icons[type as keyof typeof icons] || '📦';
  };

  const getAssetTypeLabel = (type: string) => {
    const labels = {
      application: 'Application',
      database: 'Database',
      infrastructure: 'Infrastructure',
      middleware: 'Middleware',
      'cloud-service': 'Cloud Service',
      'third-party-service': 'Third Party Service'
    };
    return labels[type as keyof typeof labels] || type;
  };

  // Step 1: Asset Type Selection
  if (currentStep === 1 && !asset) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Select Asset Type</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(assetCategories).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeSelection(type)}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{getAssetTypeIcon(type)}</span>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {getAssetTypeLabel(type)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {assetCategories[type as keyof typeof assetCategories].length} categories available
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Category Selection
  if (currentStep === 2 && formData.type && !formData.category && !asset) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Select Category</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Choose a category for {getAssetTypeLabel(formData.type)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{getAssetTypeIcon(formData.type)}</span>
                <span className="font-medium text-blue-900">
                  Selected Type: {getAssetTypeLabel(formData.type)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assetCategories[formData.type as keyof typeof assetCategories].map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategorySelection(category)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left"
                >
                  <h3 className="font-medium text-gray-900">{category}</h3>
                </button>
              ))}
            </div>

            <div className="flex justify-start mt-6">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                ← Back to Type Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Asset Details Form
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {asset ? 'Edit Asset' : 'Add New Asset'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Type and Category Display */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <span className="text-xl">{getAssetTypeIcon(formData.type)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-700">Asset Type</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {getAssetTypeLabel(formData.type)}
                  </p>
                </div>
                {asset && <Lock className="h-4 w-4 text-gray-400" title="Cannot be changed" />}
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">C</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Category</p>
                  <p className="text-lg font-semibold text-gray-900">{formData.category}</p>
                </div>
                {asset && <Lock className="h-4 w-4 text-gray-400" title="Cannot be changed" />}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asset Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner *
                </label>
                <input
                  type="text"
                  name="owner"
                  value={formData.owner}
                  onChange={handleChange}
                  required
                  placeholder="e.g., IT Department, DevOps Team"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="deprecated">Deprecated</option>
                  <option value="planned">Planned</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Criticality *
                </label>
                <select
                  name="criticality"
                  value={formData.criticality}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="Comma-separated tags (e.g., web, production, critical)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Metadata Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Metadata
                </label>
                <button
                  type="button"
                  onClick={addMetadataEntry}
                  className="inline-flex items-center px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Field
                </button>
              </div>
              
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                {metadataEntries.map((entry, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Key (e.g., version, framework)"
                        value={entry.key}
                        onChange={(e) => handleMetadataChange(index, 'key', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Value (e.g., 2.1.0, React)"
                        value={entry.value}
                        onChange={(e) => handleMetadataChange(index, 'value', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMetadataEntry(index)}
                      disabled={metadataEntries.length === 1}
                      className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Remove field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                
                {metadataEntries.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No metadata fields added. Click "Add Field" to add custom metadata.
                  </p>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                Add custom metadata as key-value pairs (e.g., version: 2.1.0, framework: React, database: PostgreSQL)
              </p>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200">
              {!asset && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  ← Change Category
                </button>
              )}
              
              <div className="flex space-x-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  {asset ? 'Update Asset' : 'Add Asset'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AssetForm;