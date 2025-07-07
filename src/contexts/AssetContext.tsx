import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Asset, AssetUpload } from '../types';
import { AssetService, AssetUploadService } from '../services/assetService';
import { useAuth } from './AuthContext';
import { useSelectedOrg } from './SelectedOrgContext';

interface AssetContextType {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  addAsset: (asset: Omit<Asset, 'id' | 'lastUpdated'>) => Promise<void>;
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  uploadAssets: (file: File) => Promise<void>;
  uploads: AssetUpload[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  refreshAssets: () => Promise<void>;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export const AssetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<AssetUpload[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const { user } = useAuth();
  const { selectedOrg } = useSelectedOrg();

  // Load assets on component mount and when org changes
  useEffect(() => {
    refreshAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.org_id, selectedOrg?.org_id]);

  // Debounced search effect to prevent excessive API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery || selectedType !== 'all') {
        handleSearch();
      } else {
        refreshAssets();
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedType]);

  // Clear search and filters when org changes
  useEffect(() => {
    setSearchQuery('');
    setSelectedType('all');
  }, [user?.org_id, selectedOrg?.org_id]);

  // Helper to get effective org_id
  const getOrgId = () => {
    if (user?.role?.startsWith('admin') && user.orgCode === 'ADMIN' && selectedOrg) {
      return selectedOrg.org_id;
    }
    return user?.org_id;
  };

  const refreshAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedAssets = await AssetService.getAssets(getOrgId());
      setAssets(fetchedAssets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      const searchResults = await AssetService.searchAssets(searchQuery, selectedType, getOrgId());
      setAssets(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search assets');
      console.error('Error searching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const addAsset = async (assetData: Omit<Asset, 'id' | 'lastUpdated'>) => {
    try {
      setError(null);
      const newAsset = await AssetService.createAsset(assetData, getOrgId());
      setAssets(prev => [newAsset, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create asset');
      throw err;
    }
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    try {
      setError(null);
      const updatedAsset = await AssetService.updateAsset(id, updates, getOrgId());
      setAssets(prev => 
        prev.map(asset => asset.id === id ? updatedAsset : asset)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update asset');
      throw err;
    }
  };

  const deleteAsset = async (id: string) => {
    try {
      setError(null);
      await AssetService.deleteAsset(id);
      setAssets(prev => prev.filter(asset => asset.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
      throw err;
    }
  };

  const uploadAssets = async (file: File) => {
    try {
      setError(null);
      
      // Create upload record
      const uploadId = await AssetUploadService.createUpload(file.name, file.size, getOrgId());
      
      const upload: AssetUpload = {
        file,
        status: 'processing',
        progress: 0
      };
      
      setUploads(prev => [...prev, upload]);
      
      // Simulate file processing with progress updates
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        await AssetUploadService.updateUploadProgress(uploadId, i, i === 100 ? 'completed' : 'processing');
        setUploads(prev => 
          prev.map(u => u.file === file ? { ...u, progress: i, status: i === 100 ? 'completed' : 'processing' } : u)
        );
      }
      
      // Simulate processing results
      const processedCount = 2;
      const errorCount = 0;
      
      await AssetUploadService.updateUploadResults(uploadId, processedCount, processedCount, errorCount, []);
      
      setUploads(prev => 
        prev.map(u => u.file === file ? { 
          ...u, 
          status: 'completed',
          results: { 
            total: processedCount, 
            processed: processedCount, 
            errors: [] 
          } 
        } : u)
      );
      
      // Refresh assets to show newly uploaded ones
      await refreshAssets();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload assets');
      setUploads(prev => 
        prev.map(u => u.file === file ? { ...u, status: 'failed' } : u)
      );
      throw err;
    }
  };

  return (
    <AssetContext.Provider value={{
      assets,
      loading,
      error,
      addAsset,
      updateAsset,
      deleteAsset,
      uploadAssets,
      uploads,
      searchQuery,
      setSearchQuery,
      selectedType,
      setSelectedType,
      refreshAssets
    }}>
      {children}
    </AssetContext.Provider>
  );
};

export const useAssets = () => {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error('useAssets must be used within an AssetProvider');
  }
  return context;
};