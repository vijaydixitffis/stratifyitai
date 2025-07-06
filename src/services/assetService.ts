import { supabase } from '../lib/supabase';
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
    metadata: { version: '2.1.0', framework: 'React' }
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
    metadata: { version: '14.2', size: '2.5TB' }
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
    metadata: { instanceCount: 5, region: 'us-west-2' }
  }
];

let mockAssetStore = [...mockAssets];

export class AssetService {
  // Check if Supabase is available
  private static isSupabaseAvailable(): boolean {
    return supabase !== null;
  }

  // Fetch all assets
  static async getAssets(): Promise<Asset[]> {
    if (!this.isSupabaseAvailable()) {
      // Return mock data when Supabase is not configured
      return Promise.resolve([...mockAssetStore]);
    }

    const { data, error } = await supabase!
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching assets:', error);
      throw new Error('Failed to fetch assets');
    }

    return data.map(this.transformAssetFromDB);
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

    const { data, error } = await supabase!
      .from('assets')
      .insert([this.transformAssetToDB(asset)])
      .select()
      .single();

    if (error) {
      console.error('Error creating asset:', error);
      throw new Error('Failed to create asset');
    }

    return this.transformAssetFromDB(data);
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

    const { data, error } = await supabase!
      .from('assets')
      .update(this.transformAssetToDB(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating asset:', error);
      throw new Error('Failed to update asset');
    }

    return this.transformAssetFromDB(data);
  }

  // Delete an asset
  static async deleteAsset(id: string): Promise<void> {
    if (!this.isSupabaseAvailable()) {
      // Mock implementation
      mockAssetStore = mockAssetStore.filter(a => a.id !== id);
      return Promise.resolve();
    }

    const { error } = await supabase!
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting asset:', error);
      throw new Error('Failed to delete asset');
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
      throw new Error('Failed to search assets');
    }

    return data.map(this.transformAssetFromDB);
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
      lastUpdated: new Date(dbAsset.updated_at).toISOString().split('T')[0]
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
      status: asset.status,
      criticality: asset.criticality,
      tags: asset.tags || [],
      metadata: asset.metadata || {},
      created_by: asset.createdBy
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
    if (!supabase) {
      // Mock implementation
      return Promise.resolve(Date.now().toString());
    }

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
      throw new Error('Failed to create upload record');
    }

    return data.id;
  }

  // Update upload progress
  static async updateUploadProgress(
    uploadId: string, 
    progress: number, 
    status?: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    if (!supabase) {
      // Mock implementation
      return Promise.resolve();
    }

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
      throw new Error('Failed to update upload progress');
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
    if (!supabase) {
      // Mock implementation
      return Promise.resolve();
    }

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
      throw new Error('Failed to update upload results');
    }
  }

  // Get user uploads
  static async getUserUploads(): Promise<any[]> {
    if (!supabase) {
      // Mock implementation
      return Promise.resolve([]);
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('asset_uploads')
      .select('*')
      .eq('uploaded_by', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching uploads:', error);
      throw new Error('Failed to fetch uploads');
    }

    return data || [];
  }
}