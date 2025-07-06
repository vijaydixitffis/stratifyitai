import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Organization {
  org_id: number;
  org_code: string;
  org_name: string;
  description?: string;
  sector?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationRequest {
  org_code: string;
  org_name: string;
  description?: string;
  sector?: string;
  remarks?: string;
}

export interface UpdateOrganizationRequest {
  org_code?: string;
  org_name?: string;
  description?: string;
  sector?: string;
  remarks?: string;
}

export class OrganizationService {
  static async getOrganizations(): Promise<Organization[]> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock data for demo mode
      return [
        {
          org_id: 1,
          org_code: 'TECH1',
          org_name: 'TechCorp Inc.',
          description: 'Leading technology solutions provider',
          sector: 'Technology',
          remarks: 'Primary client',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          org_id: 2,
          org_code: 'STRAT',
          org_name: 'StratifyIT.ai',
          description: 'IT consulting and strategy firm',
          sector: 'Consulting',
          remarks: 'Internal organization',
          created_at: '2024-01-10T09:15:00Z',
          updated_at: '2024-01-10T09:15:00Z'
        },
        {
          org_id: 3,
          org_code: 'FIN01',
          org_name: 'FinanceCorp',
          description: 'Financial services company',
          sector: 'Finance',
          remarks: 'New client',
          created_at: '2024-01-20T14:30:00Z',
          updated_at: '2024-01-20T14:30:00Z'
        }
      ];
    }

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching organizations:', error);
      throw new Error('Failed to fetch organizations');
    }
  }

  static async createOrganization(orgData: CreateOrganizationRequest): Promise<Organization> {
    // Validate org code length
    if (orgData.org_code.length !== 5) {
      throw new Error('Organization code must be exactly 5 characters');
    }

    if (!isSupabaseConfigured() || !supabase) {
      // Mock creation for demo mode
      const newOrg: Organization = {
        org_id: Date.now(),
        org_code: orgData.org_code,
        org_name: orgData.org_name,
        description: orgData.description,
        sector: orgData.sector,
        remarks: orgData.remarks,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return newOrg;
    }

    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          org_code: orgData.org_code,
          org_name: orgData.org_name,
          description: orgData.description,
          sector: orgData.sector,
          remarks: orgData.remarks
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw new Error('Failed to create organization');
    }
  }

  static async updateOrganization(orgId: number, updates: UpdateOrganizationRequest): Promise<Organization> {
    // Validate org code length if provided
    if (updates.org_code && updates.org_code.length !== 5) {
      throw new Error('Organization code must be exactly 5 characters');
    }

    if (!isSupabaseConfigured() || !supabase) {
      // Mock update for demo mode
      const updatedOrg: Organization = {
        org_id: orgId,
        org_code: updates.org_code || '',
        org_name: updates.org_name || '',
        description: updates.description,
        sector: updates.sector,
        remarks: updates.remarks,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return updatedOrg;
    }

    try {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('org_id', orgId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating organization:', error);
      throw new Error('Failed to update organization');
    }
  }

  static async deleteOrganization(orgId: number): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock deletion for demo mode
      return;
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('org_id', orgId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
      throw new Error('Failed to delete organization');
    }
  }

  static async getOrganizationByCode(orgCode: string): Promise<Organization | null> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock lookup for demo mode
      const orgs = await this.getOrganizations();
      return orgs.find(org => org.org_code === orgCode) || null;
    }

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('org_code', orgCode)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows returned
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching organization by code:', error);
      throw new Error('Failed to fetch organization');
    }
  }
} 