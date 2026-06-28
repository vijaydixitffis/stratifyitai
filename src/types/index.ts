export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'client-manager' | 'client-architect' | 'client-cxo';
  organization: string;
  orgCode?: string;
  org_id?: number;
}

export interface Asset {
  id: string;
  name: string;
  type: 'application' | 'infrastructure' | 'database' | 'middleware' | 'cloud-service' | 'third-party-service';
  category: string;
  description: string;
  owner: string;
  owner_email?: string;
  status: 'active' | 'inactive' | 'deprecated' | 'planned';
  criticality: 'high' | 'medium' | 'low';
  lastUpdated: string;
  createdBy: string;
  tags: string[];
  metadata: Record<string, any>;
  org_id?: number;
  // CMDB identification & sourcing
  asset_tag?: string;
  vendor?: string;
  sourcing_type?: 'cots' | 'custom_built' | 'open_source' | 'saas';
  business_unit?: string;
  environment?: 'production' | 'staging' | 'development' | 'test' | 'dr';
  // Infrastructure identity
  hostname?: string;
  ip_address?: string;
  serial_number?: string;
  location?: string;
  // Lifecycle dates
  purchase_date?: string;
  warranty_end_date?: string;
  end_of_life_date?: string;
  end_of_support_date?: string;
  last_reviewed_date?: string;
  // Financial
  annual_cost?: number;
  license_type?: string;
  license_expiry_date?: string;
  support_contract_id?: string;
  // Compliance & risk
  data_classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  compliance_tags?: string[];
  criticality_justification?: string;
}

export interface AssetUpload {
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: {
    total: number;
    processed: number;
    errors: string[];
  };
}
