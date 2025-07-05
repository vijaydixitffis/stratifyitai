export interface User {
  id: string;
  name: string;
  email: string;
  role: 'client-manager' | 'client-architect' | 'client-cxo' | 'admin-consultant' | 'admin-architect' | 'admin-super';
  organization: string;
}

export interface Asset {
  id: string;
  name: string;
  type: 'application' | 'infrastructure' | 'database' | 'middleware' | 'cloud-service' | 'third-party-service';
  category: string;
  description: string;
  owner: string;
  status: 'active' | 'inactive' | 'deprecated' | 'planned';
  criticality: 'high' | 'medium' | 'low';
  lastUpdated: string;
  createdBy: string;
  tags: string[];
  metadata: Record<string, any>;
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