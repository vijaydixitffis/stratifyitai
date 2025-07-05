import React, { useState, useEffect } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Trash2 } from 'lucide-react';

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
  const [formData, setFormData] = useState({
    name: '',
    type: 'application',
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
                  Asset Type *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="application">Application</option>
                  <option value="database">Database</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="middleware">Middleware</option>
                  <option value="cloud-service">Cloud Service</option>
                  <option value="third-party-service">Third Party Service</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Web Application, PostgreSQL, AWS EC2"
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

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
          </form>
        </div>
      </div>
    </div>
  );
};

export default AssetForm;