import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Asset } from '../types';
import { processCSVRow, buildTechnicalSpecsJSON } from '../utils/csvColumnMapping';

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
  static async getAssets(org_id?: number): Promise<Asset[]> {
    if (!this.isSupabaseAvailable()) {
      // Return mock data when Supabase is not configured
      console.log('Using mock data - Supabase not configured');
      return Promise.resolve([...mockAssetStore]);
    }

    try {
      console.log('Fetching assets from Supabase...');

      // Check if user is admin first
      const isAdmin = await this.isUserAdmin();

      if (isAdmin) {
        console.log('Admin user detected, fetching all assets...');
        // Admin users get all assets
        const { data, error } = await supabase!
          .from('it_assets')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching assets for admin:', error);
          throw new Error(`Failed to fetch assets: ${error.message}`);
        }

        console.log('Successfully fetched assets for admin:', data?.length || 0);
        return data ? data.map(this.transformAssetFromDB) : [];
      } else {
        // Client users with org filtering
        let query = supabase!
          .from('it_assets')
          .select('*')
          .order('created_at', { ascending: false });

        if (org_id) {
          query = query.eq('org_id', org_id);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching assets for client:', error);
          throw new Error(`Failed to fetch assets: ${error.message}`);
        }

        console.log('Successfully fetched assets for client:', data?.length || 0);
        return data ? data.map(this.transformAssetFromDB) : [];
      }

    } catch (error) {
      console.error('Error in getAssets:', error);
      throw error;
    }
  }

  // Helper method to check if user is admin
  private static async isUserAdmin(): Promise<boolean> {
    try {
      // Get user role directly from session metadata to avoid RLS recursion
      const { data: { session } } = await supabase!.auth.getSession();
      const userRole = session?.user?.user_metadata?.role;
      
      return userRole && userRole.startsWith('admin-');
    } catch (error) {
      console.error('Error in isUserAdmin:', error);
      return false;
    }
  }

  // Create a new asset
  static async createAsset(asset: Omit<Asset, 'id' | 'lastUpdated'>, org_id?: number): Promise<Asset> {
    if (!this.isSupabaseAvailable()) {
      // Mock implementation
      const newAsset: Asset = {
        ...asset,
        id: Date.now().toString(),
        lastUpdated: new Date().toISOString().split('T')[0],
        org_id
      };
      mockAssetStore.unshift(newAsset);
      return Promise.resolve(newAsset);
    }

    try {
      const { data, error } = await supabase!
        .from('it_assets')
        .insert([{ ...this.transformAssetToDB(asset), org_id }])
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
  static async updateAsset(id: string, updates: Partial<Asset>, org_id?: number): Promise<Asset> {
    if (!this.isSupabaseAvailable()) {
      // Mock implementation
      const index = mockAssetStore.findIndex(a => a.id === id);
      if (index === -1) {
        throw new Error('Asset not found');
      }
      const updatedAsset = {
        ...mockAssetStore[index],
        ...updates,
        lastUpdated: new Date().toISOString().split('T')[0],
        org_id: org_id ?? mockAssetStore[index].org_id
      };
      mockAssetStore[index] = updatedAsset;
      return Promise.resolve(updatedAsset);
    }

    try {
      const { data, error } = await supabase!
        .from('it_assets')
        .update({ ...this.transformAssetToDB(updates), org_id })
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
        .from('it_assets')
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
  static async searchAssets(query: string, type?: string, org_id?: number): Promise<Asset[]> {
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
      if (org_id) {
        filtered = filtered.filter(asset => asset.org_id === org_id);
      }

      return Promise.resolve(filtered);
    }

    try {
      // Check if user is admin first
      const isAdmin = await this.isUserAdmin();

      if (isAdmin) {
        console.log('Admin user searching assets...');
        // Admin users can search all assets
        let queryBuilder = supabase!
          .from('it_assets')
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
          console.error('Error searching assets for admin:', error);
          throw new Error(`Failed to search assets: ${error.message}`);
        }

        return data ? data.map(this.transformAssetFromDB) : [];
      } else {
        // Client users with org filtering
        let queryBuilder = supabase!
          .from('it_assets')
          .select('*');

        if (query) {
          queryBuilder = queryBuilder.or(`name.ilike.%${query}%,description.ilike.%${query}%,owner.ilike.%${query}%`);
        }

        if (type && type !== 'all') {
          queryBuilder = queryBuilder.eq('type', type);
        }
        if (org_id) {
          queryBuilder = queryBuilder.eq('org_id', org_id);
        }

        const { data, error } = await queryBuilder
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error searching assets for client:', error);
          throw new Error(`Failed to search assets: ${error.message}`);
        }

        return data ? data.map(this.transformAssetFromDB) : [];
      }

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
      owner_email: dbAsset.owner_email,
      status: dbAsset.status,
      criticality: dbAsset.criticality,
      tags: dbAsset.tags || [],
      metadata: dbAsset.metadata || {},
      createdBy: dbAsset.created_by,
      lastUpdated: new Date(dbAsset.updated_at || dbAsset.created_at).toISOString().split('T')[0],
      // CMDB fields
      asset_tag: dbAsset.asset_tag,
      vendor: dbAsset.vendor,
      sourcing_type: dbAsset.sourcing_type,
      business_unit: dbAsset.business_unit,
      environment: dbAsset.environment,
      hostname: dbAsset.hostname,
      ip_address: dbAsset.ip_address,
      serial_number: dbAsset.serial_number,
      location: dbAsset.location,
      purchase_date: dbAsset.purchase_date,
      warranty_end_date: dbAsset.warranty_end_date,
      end_of_life_date: dbAsset.end_of_life_date,
      end_of_support_date: dbAsset.end_of_support_date,
      last_reviewed_date: dbAsset.last_reviewed_date,
      annual_cost: dbAsset.annual_cost,
      license_type: dbAsset.license_type,
      license_expiry_date: dbAsset.license_expiry_date,
      support_contract_id: dbAsset.support_contract_id,
      data_classification: dbAsset.data_classification,
      compliance_tags: dbAsset.compliance_tags,
      criticality_justification: dbAsset.criticality_justification,
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
      owner_email: asset.owner_email ?? null,
      status: asset.status || 'active',
      criticality: asset.criticality || 'medium',
      tags: asset.tags || [],
      metadata: asset.metadata || {},
      created_by: asset.createdBy || 'system',
      // CMDB identification & sourcing
      asset_tag:               asset.asset_tag               ?? null,
      vendor:                  asset.vendor                  ?? null,
      sourcing_type:           asset.sourcing_type           ?? null,
      business_unit:           asset.business_unit           ?? null,
      environment:             asset.environment             ?? null,
      // Infrastructure identity
      hostname:                asset.hostname                ?? null,
      ip_address:              asset.ip_address              ?? null,
      serial_number:           asset.serial_number           ?? null,
      location:                asset.location                ?? null,
      // Lifecycle dates
      purchase_date:           asset.purchase_date           ?? null,
      warranty_end_date:       asset.warranty_end_date       ?? null,
      end_of_life_date:        asset.end_of_life_date        ?? null,
      end_of_support_date:     asset.end_of_support_date     ?? null,
      last_reviewed_date:      asset.last_reviewed_date      ?? null,
      // Financial
      annual_cost:             asset.annual_cost             ?? null,
      license_type:            asset.license_type            ?? null,
      license_expiry_date:     asset.license_expiry_date     ?? null,
      support_contract_id:     asset.support_contract_id     ?? null,
      // Compliance & risk
      data_classification:     asset.data_classification     ?? null,
      compliance_tags:         asset.compliance_tags         ?? null,
      criticality_justification: asset.criticality_justification ?? null,
    };

    if (asset.id) {
      dbAsset.id = asset.id;
    }

    return dbAsset;
  }

  // Process CSV row and convert to asset format with CMDB field mapping
  static processCSVRowToAsset(csvRow: Record<string, string>): Omit<Asset, 'id' | 'lastUpdated'> {
    const { standardColumns, technicalSpecs, additionalSpecs } = processCSVRow(csvRow);

    // ── Enum validation ────────────────────────────────────────────────────────
    const validAssetTypes   = ['application','infrastructure','database','middleware','cloud-service','third-party-service'];
    const validStatuses     = ['active','inactive','deprecated','planned'];
    const validCriticalities= ['high','medium','low'];
    const validSourcing     = ['cots','custom_built','open_source','saas'];
    const validEnvironments = ['production','staging','development','test','dr'];
    const validDataClass    = ['public','internal','confidential','restricted'];

    const assetTypeAliases: Record<string, string> = {
      'sso':'third-party-service','iam':'third-party-service',
      'erp':'application','crm':'application',
      'rdbms':'database','etl':'middleware',
      'edr':'third-party-service','dlp':'third-party-service',
      'waf':'infrastructure','vpn':'infrastructure',
      'dc':'infrastructure','cdn':'cloud-service',
    };

    const col = (key: string) => standardColumns[key] || csvRow[key] || '';

    const rawType   = col('Asset Type').toLowerCase();
    const assetType = assetTypeAliases[rawType] || rawType;
    const status    = col('Status').toLowerCase() || 'active';
    const criticality = col('Criticality').toLowerCase() || 'medium';

    // ── Tags ──────────────────────────────────────────────────────────────────
    const tags = standardColumns['Tags']
      ? standardColumns['Tags'].split(',').map(t => t.trim()).filter(Boolean)
      : [];

    // ── Compliance tags → text[] ───────────────────────────────────────────
    const complianceRaw = standardColumns['Compliance Tags'];
    const compliance_tags: string[] | undefined = complianceRaw
      ? complianceRaw
          .replace(/^["\s]+|["\s]+$/g, '')
          .split(',')
          .map(t => t.trim().replace(/^"+|"+$/g, ''))
          .filter(Boolean)
      : undefined;

    // ── Annual cost → numeric ─────────────────────────────────────────────
    const costRaw   = standardColumns['Annual Cost']?.replace(/[^0-9.]/g, '');
    const annual_cost = costRaw ? parseFloat(costRaw) || undefined : undefined;

    // ── Enum-gated CMDB scalars ───────────────────────────────────────────
    const sourcingRaw = standardColumns['Sourcing Type']?.toLowerCase().replace(/[\s-]/g, '_');
    const sourcing_type = validSourcing.includes(sourcingRaw ?? '') ? sourcingRaw as Asset['sourcing_type'] : undefined;

    const envRaw    = standardColumns['Environment']?.toLowerCase();
    const environment = validEnvironments.includes(envRaw ?? '') ? envRaw as Asset['environment'] : undefined;

    const dataClassRaw = standardColumns['Data Classification']?.toLowerCase();
    const data_classification = validDataClass.includes(dataClassRaw ?? '') ? dataClassRaw as Asset['data_classification'] : undefined;

    // ── Metadata: parsed Technical Specs (JSON) + loose tech-spec columns ─
    // Technical Specs (JSON) is now in standardColumns (not additionalSpecs)
    let techSpecsFromJSON: Record<string, any> = {};
    if (standardColumns['Technical Specs (JSON)']) {
      try {
        techSpecsFromJSON = JSON.parse(standardColumns['Technical Specs (JSON)']);
      } catch {
        // store raw string so it's at least visible in the view modal
        techSpecsFromJSON = { raw_technical_specs: standardColumns['Technical Specs (JSON)'] };
      }
    }

    // Relationship columns → metadata.relationships (for display until graph feature ships)
    const relKeys: Array<[string, string]> = [
      ['Runs On', 'runs_on'], ['Depends On', 'depends_on'],
      ['Connects To', 'connects_to'], ['Part Of', 'part_of'], ['Backs Up', 'backs_up'],
    ];
    const relationships: Record<string, string> = {};
    for (const [col, key] of relKeys) {
      if (standardColumns[col]) relationships[key] = standardColumns[col];
    }

    const metadata: Record<string, any> = {
      ...techSpecsFromJSON,
      ...technicalSpecs,
      ...(Object.keys(additionalSpecs).length > 0  ? { additional_specs: additionalSpecs }   : {}),
      ...(Object.keys(relationships).length   > 0  ? { relationships }                       : {}),
    };

    return {
      name:        col('Asset Name'),
      type:        (validAssetTypes.includes(assetType) ? assetType : 'application') as Asset['type'],
      category:    col('Category'),
      description: col('Description'),
      owner:       col('Owner'),
      owner_email: standardColumns['Owner Email'] || undefined,
      status:      (validStatuses.includes(status) ? status : 'active') as Asset['status'],
      criticality: (validCriticalities.includes(criticality) ? criticality : 'medium') as Asset['criticality'],
      tags,
      metadata,
      createdBy:   'csv-upload',
      // CMDB identification & sourcing
      asset_tag:               standardColumns['Asset Tag']          || undefined,
      vendor:                  standardColumns['Vendor']             || undefined,
      sourcing_type,
      business_unit:           standardColumns['Business Unit']      || undefined,
      environment,
      // Infrastructure identity
      hostname:                standardColumns['Hostname']           || undefined,
      ip_address:              standardColumns['IP Address']         || undefined,
      serial_number:           standardColumns['Serial Number']      || undefined,
      location:                standardColumns['Location']           || undefined,
      // Lifecycle dates
      purchase_date:           standardColumns['Purchase Date']      || undefined,
      warranty_end_date:       standardColumns['Warranty End Date']  || undefined,
      end_of_life_date:        standardColumns['End of Life Date']   || undefined,
      end_of_support_date:     standardColumns['End of Support Date']|| undefined,
      last_reviewed_date:      standardColumns['Last Reviewed Date'] || undefined,
      // Financial
      annual_cost,
      license_type:            standardColumns['License Type']       || undefined,
      license_expiry_date:     standardColumns['License Expiry Date']|| undefined,
      support_contract_id:     standardColumns['Support Contract ID']|| undefined,
      // Compliance & risk
      data_classification,
      compliance_tags,
      criticality_justification: standardColumns['Criticality Justification'] || undefined,
    };
  }

  // Bulk create assets from CSV data
  static async bulkCreateAssets(
    csvRows: Record<string, string>[],
    org_id?: number
  ): Promise<{ inserted: number; errors: string[] }> {
    if (!this.isSupabaseAvailable()) {
      // Mock implementation
      const assets = csvRows.map((row, index) => ({
        ...this.processCSVRowToAsset(row),
        id: `csv-${Date.now()}-${index}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        org_id
      }));
      mockAssetStore.unshift(...assets);
      return Promise.resolve({ inserted: assets.length, errors: [] });
    }

    const errors: string[] = [];
    let inserted = 0;

    for (const row of csvRows) {
      try {
        const asset = this.processCSVRowToAsset(row);
        await this.createAsset(asset, org_id);
        inserted++;
      } catch (error) {
        const assetName = row['Asset Name'] || 'Unknown';
        errors.push(`${assetName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { inserted, errors };
  }
}

export class AssetUploadService {
  // Create upload record
  static async createUpload(fileName: string, fileSize: number, org_id?: number): Promise<string> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock implementation
      return Promise.resolve(Date.now().toString());
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('it_asset_uploads')
        .insert([{
          file_name: fileName,
          file_size: fileSize,
          uploaded_by: user?.id,
          org_id
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
        .from('it_asset_uploads')
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
        .from('it_asset_uploads')
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
        .from('it_asset_uploads')
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