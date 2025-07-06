import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Asset } from '../types';

// Mock data for when Supabase is not configured
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
    metadata: { version: '2.1.0', framework: 'React', hosting: 'AWS' }
  },
  {
    id: '2',
    name: 'Production Database',
    type: 'database',
    category: 'RDBMS (PostgreSQL)',
    description: 'Primary production database for customer data',
    owner: 'Database Team',
    status: 'active',
    criticality: 'high',
    lastUpdated: '2024-01-12',
    createdBy: 'sarah@company.com',
    tags: ['database', 'production', 'postgresql'],
    metadata: { version: '14.2', size: '2.5TB', backup_frequency: 'daily' }
  },
  {
    id: '3',
    name: 'AWS EC2 Instances',
    type: 'infrastructure',
    category: 'Virtual Machine',
    description: 'Production web servers on AWS',
    owner: 'DevOps Team',
    status: 'active',
    criticality: 'high',
    lastUpdated: '2024-01-10',
    createdBy: 'mike@stratifyit.ai',
    tags: ['aws', 'ec2', 'compute'],
    metadata: { instance_count: 5, region: 'us-west-2', instance_type: 't3.large' }
  },
  {
    id: '4',
    name: 'API Gateway',
    type: 'middleware',
    category: 'API Gateway',
    description: 'Central API management and routing',
    owner: 'Platform Team',
    status: 'active',
    criticality: 'medium',
    lastUpdated: '2024-01-08',
    createdBy: 'system',
    tags: ['api', 'gateway', 'middleware'],
    metadata: { version: '2.0', requests_per_day: '1M', endpoints: 45 }
  },
  {
    id: '5',
    name: 'Monitoring Service',
    type: 'third-party-service',
    category: 'Monitoring Service',
    description: 'Application monitoring and alerting platform',
    owner: 'SRE Team',
    status: 'active',
    criticality: 'low',
    lastUpdated: '2024-01-05',
    createdBy: 'system',
    tags: ['monitoring', 'observability', 'alerts'],
    metadata: { vendor: 'DataDog', plan: 'Pro', retention: '30 days' }
  },
  {
    id: '6',
    name: 'Legacy ERP System',
    type: 'application',
    category: 'Enterprise Application',
    description: 'Legacy ERP system for financial operations',
    owner: 'Finance Team',
    status: 'deprecated',
    criticality: 'medium',
    lastUpdated: '2024-01-01',
    createdBy: 'system',
    tags: ['erp', 'legacy', 'finance'],
    metadata: { vendor: 'SAP', version: '6.0', end_of_life: '2025-12-31' }
  }
];

let mockAssetStore = [...mockAssets];

export class AssetService {
  // Check if Supabase is available
  private static isSupabaseAvailable(): boolean {
    return isSupabaseConfigured();
  }

  // Fetch all assets
  static async getAssets(): Promise<Asset[]> {
    if (!this.isSupabaseAvailable()) {
      // Return mock data when Supabase is not configured
      console.log('Using mock data - Supabase not configured');
      return Promise.resolve([...mockAssetStore]);
    }

    try {
      console.log('Fetching assets from Supabase...');
      const { data, error } = await supabase!
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching assets:', error);
        throw new Error(`Failed to fetch assets: ${error.message}`);
      }

      console.log('Successfully fetched assets from Supabase:', data?.length || 0);
      return data ? data.map(this.transformAssetFromDB) : [];
    } catch (error) {
      console.error('Error in getAssets:', error);
      throw error;
    }
  }

  // Create a new asset
  static async createAsset(asset: Omit<Asset, 'id' | 'lastUpdated'>): Promise<Asset> {
    if (!this.isSupabaseAvailable()) {
      // Mock implementation
      const newAsset: Asset = {
        ...asset,
        id: Date.now().toString(),
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      mockAssetStore.unshift(newAsset);
      return Promise.resolve(newAsset);
    }

    try {
      const { data, error } = await supabase!
        .from('assets')
        .insert([this.transformAssetToDB(asset)])
        .select()
        .single();

      if (error) {
        console.error('Error creating asset:', error);
        throw new Error(`Failed to create asset: ${error.message}`);
      }

      return this.transformAssetFromDB(data);
    } catch (error) {
      console.error('Error in createAsset:', error);
      throw error;
    }
  }

  // Update an existing asset
  static async updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
    if (!this.isSupabaseAvailable()) {
      // Mock implementation
      const index = mockAssetStore.findIndex(a => a.id === id);
      if (index === -1) {
        throw new Error('Asset not found');
      }
      const updatedAsset = {
        ...mockAssetStore[index],
        ...updates,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      mockAssetStore[index] = updatedAsset;
      return Promise.resolve(updatedAsset);
    }

    try {
      const { data, error } = await supabase!
        .from('assets')
        .update(this.transformAssetToDB(updates))
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating asset:', error);
        throw new Error(`Failed to update asset: ${error.message}`);
      }

      return this.transformAssetFromDB(data);
    } catch (error) {
      console.error('Error in updateAsset:', error);
      throw error;
    }
  }

  // Delete an asset
  static async deleteAsset(id: string): Promise<void> {
    if (!this.isSupabaseAvailable()) {
      // Mock implementation
      mockAssetStore = mockAssetStore.filter(a => a.id !== id);
      return Promise.resolve();
    }

    try {
      const { error } = await supabase!
        .from('assets')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting asset:', error);
        throw new Error(`Failed to delete asset: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in deleteAsset:', error);
      throw error;
    }
  }

  // Search assets
  static async searchAssets(query: string, type?: string): Promise<Asset[]> {
    if (!this.isSupabaseAvailable()) {
      // Mock implementation
      let filtered = [...mockAssetStore];
      
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(asset =>
          asset.name.toLowerCase().includes(lowerQuery) ||
          asset.description.toLowerCase().includes(lowerQuery) ||
          asset.owner.toLowerCase().includes(lowerQuery)
        );
      }
      
      if (type && type !== 'all') {
        filtered = filtered.filter(asset => asset.type === type);
      }
      
      return Promise.resolve(filtered);
    }

    try {
      let queryBuilder = supabase!
        .from('assets')
        .select('*');

      if (query) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query}%,description.ilike.%${query}%,owner.ilike.%${query}%`);
      }

      if (type && type !== 'all') {
        queryBuilder = queryBuilder.eq('type', type);
      }

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching assets:', error);
        throw new Error(`Failed to search assets: ${error.message}`);
      }

      return data ? data.map(this.transformAssetFromDB) : [];
    } catch (error) {
      console.error('Error in searchAssets:', error);
      throw error;
    }
  }

  // Transform asset from database format to application format
  private static transformAssetFromDB(dbAsset: any): Asset {
    return {
      id: dbAsset.id,
      name: dbAsset.name,
      type: dbAsset.type,
      category: dbAsset.category,
      description: dbAsset.description,
      owner: dbAsset.owner,
      status: dbAsset.status,
      criticality: dbAsset.criticality,
      tags: dbAsset.tags || [],
      metadata: dbAsset.metadata || {},
      createdBy: dbAsset.created_by,
      lastUpdated: new Date(dbAsset.updated_at || dbAsset.created_at).toISOString().split('T')[0]
    };
  }

  // Transform asset from application format to database format
  private static transformAssetToDB(asset: any): any {
    const dbAsset: any = {
      name: asset.name,
      type: asset.type,
      category: asset.category,
      description: asset.description,
      owner: asset.owner,
      status: asset.status || 'active',
      criticality: asset.criticality || 'medium',
      tags: asset.tags || [],
      metadata: asset.metadata || {},
      created_by: asset.createdBy || 'system'
    };

    // Only include id if it exists (for updates)
    if (asset.id) {
      dbAsset.id = asset.id;
    }

    return dbAsset;
  }
}

export class AssetUploadService {
  // Create upload record
  static async createUpload(fileName: string, fileSize: number): Promise<string> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock implementation
      return Promise.resolve(Date.now().toString());
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('asset_uploads')
        .insert([{
          file_name: fileName,
          file_size: fileSize,
          uploaded_by: user?.id
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating upload record:', error);
        throw new Error(`Failed to create upload record: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error('Error in createUpload:', error);
      throw error;
    }
  }

  // Update upload progress
  static async updateUploadProgress(
    uploadId: string, 
    progress: number, 
    status?: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock implementation
      return Promise.resolve();
    }

    try {
      const updates: any = { progress };
      
      if (status) {
        updates.status = status;
        if (status === 'completed' || status === 'failed') {
          updates.completed_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('asset_uploads')
        .update(updates)
        .eq('id', uploadId);

      if (error) {
        console.error('Error updating upload progress:', error);
        throw new Error(`Failed to update upload progress: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in updateUploadProgress:', error);
      throw error;
    }
  }

  // Update upload results
  static async updateUploadResults(
    uploadId: string,
    totalRows: number,
    processedRows: number,
    errorRows: number,
    errors: any[]
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock implementation
      return Promise.resolve();
    }

    try {
      const { error } = await supabase
        .from('asset_uploads')
        .update({
          total_rows: totalRows,
          processed_rows: processedRows,
          error_rows: errorRows,
          errors: errors,
          status: errorRows > 0 ? 'completed' : 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadId);

      if (error) {
        console.error('Error updating upload results:', error);
        throw new Error(`Failed to update upload results: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in updateUploadResults:', error);
      throw error;
    }
  }

  // Get user uploads
  static async getUserUploads(): Promise<any[]> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock implementation
      return Promise.resolve([]);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('asset_uploads')
        .select('*')
        .eq('uploaded_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching uploads:', error);
        throw new Error(`Failed to fetch uploads: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserUploads:', error);
      throw error;
    }
  }
}