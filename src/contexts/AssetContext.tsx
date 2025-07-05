import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Asset, AssetUpload } from '../types';

interface AssetContextType {
  assets: Asset[];
  addAsset: (asset: Omit<Asset, 'id' | 'lastUpdated'>) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  uploadAssets: (file: File) => Promise<void>;
  uploads: AssetUpload[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

// Mock assets for demonstration
const mockAssets: Asset[] = [
  {
    id: '1',
    name: 'Customer Portal',
    type: 'application',
    category: 'Web Application',
    description: 'Main customer-facing portal for account management',
    owner: 'IT Department',
    status: 'active',
    criticality: 'high',
    lastUpdated: '2024-01-15',
    createdBy: 'john@company.com',
    tags: ['web', 'customer', 'portal'],
    metadata: { version: '2.1.0', framework: 'React' }
  },
  {
    id: '2',
    name: 'Production Database',
    type: 'database',
    category: 'PostgreSQL',
    description: 'Primary production database for customer data',
    owner: 'Database Team',
    status: 'active',
    criticality: 'high',
    lastUpdated: '2024-01-12',
    createdBy: 'sarah@company.com',
    tags: ['database', 'production', 'postgresql'],
    metadata: { version: '14.2', size: '2.5TB' }
  },
  {
    id: '3',
    name: 'AWS EC2 Instances',
    type: 'infrastructure',
    category: 'Compute',
    description: 'Production web servers on AWS',
    owner: 'DevOps Team',
    status: 'active',
    criticality: 'high',
    lastUpdated: '2024-01-10',
    createdBy: 'mike@stratifyit.ai',
    tags: ['aws', 'ec2', 'compute'],
    metadata: { instanceCount: 5, region: 'us-west-2' }
  }
];

export const AssetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<Asset[]>(mockAssets);
  const [uploads, setUploads] = useState<AssetUpload[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  const addAsset = (assetData: Omit<Asset, 'id' | 'lastUpdated'>) => {
    const newAsset: Asset = {
      ...assetData,
      id: Date.now().toString(),
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    setAssets(prev => [...prev, newAsset]);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => 
      prev.map(asset => 
        asset.id === id 
          ? { ...asset, ...updates, lastUpdated: new Date().toISOString().split('T')[0] }
          : asset
      )
    );
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(asset => asset.id !== id));
  };

  const uploadAssets = async (file: File) => {
    const upload: AssetUpload = {
      file,
      status: 'processing',
      progress: 0
    };
    
    setUploads(prev => [...prev, upload]);
    
    // Simulate file processing
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setUploads(prev => 
        prev.map(u => u.file === file ? { ...u, progress: i } : u)
      );
    }
    
    // Simulate successful processing
    const mockProcessedAssets = [
      {
        name: 'Legacy ERP System',
        type: 'application' as const,
        category: 'Enterprise Application',
        description: 'Legacy ERP system for financial operations',
        owner: 'Finance Team',
        status: 'active' as const,
        criticality: 'medium' as const,
        createdBy: 'system',
        tags: ['erp', 'legacy', 'finance'],
        metadata: { vendor: 'SAP', version: '6.0' }
      },
      {
        name: 'MongoDB Cluster',
        type: 'database' as const,
        category: 'NoSQL Database',
        description: 'MongoDB cluster for analytics data',
        owner: 'Analytics Team',
        status: 'active' as const,
        criticality: 'medium' as const,
        createdBy: 'system',
        tags: ['mongodb', 'nosql', 'analytics'],
        metadata: { nodes: 3, version: '6.0' }
      }
    ];
    
    mockProcessedAssets.forEach(asset => addAsset(asset));
    
    setUploads(prev => 
      prev.map(u => u.file === file ? { 
        ...u, 
        status: 'completed', 
        results: { 
          total: 2, 
          processed: 2, 
          errors: [] 
        } 
      } : u)
    );
  };

  return (
    <AssetContext.Provider value={{
      assets,
      addAsset,
      updateAsset,
      deleteAsset,
      uploadAssets,
      uploads,
      searchQuery,
      setSearchQuery,
      selectedType,
      setSelectedType
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