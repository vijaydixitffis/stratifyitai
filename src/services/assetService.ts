import { supabase } from '../lib/supabase';
import { Asset } from '../types';

export class AssetService {
  // Fetch all assets
  static async getAssets(): Promise<Asset[]> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { error } = await supabase
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
    let queryBuilder = supabase
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