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
          org_code: 'FFITS',
          org_name: 'Future Focus IT Solutions',
          description: 'IT solutions and consulting company',
          sector: 'Technology',
          remarks: 'Manasvee Dixit organization',
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
      console.log('Fetching organizations from Supabase...');

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000); // Reduced to 5 seconds
      });

      const fetchPromise = supabase
        .from('client_orgs')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.error('Error fetching organizations:', error);
        throw error;
      }

      console.log('Successfully fetched organizations:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error fetching organizations:', error);
      // Return cached data or empty array if available
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
      console.log('Creating organization:', orgData);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000); // Reduced to 5 seconds
      });

      const createPromise = supabase
        .from('client_orgs')
        .insert({
          org_code: orgData.org_code.toUpperCase(), // Ensure uppercase
          org_name: orgData.org_name,
          description: orgData.description || `Organization for ${orgData.org_name}`,
          sector: orgData.sector || 'Technology',
          remarks: orgData.remarks || 'Newly created organization'
        })
        .select()
        .single();

      const { data, error } = await Promise.race([createPromise, timeoutPromise]);

      if (error) {
        console.error('Error creating organization:', error);
        if (error.code === '23505') { // Unique constraint violation
          throw new Error(`Organization code '${orgData.org_code}' already exists`);
        }
        throw error;
      }

      console.log('Organization created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw new Error(`Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      console.log('Updating organization:', orgId, updates);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000); // Reduced to 5 seconds
      });

      // Prepare update data
      const updateData: any = {};
      if (updates.org_code) updateData.org_code = updates.org_code.toUpperCase();
      if (updates.org_name) updateData.org_name = updates.org_name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.sector !== undefined) updateData.sector = updates.sector;
      if (updates.remarks !== undefined) updateData.remarks = updates.remarks;

      const updatePromise = supabase
        .from('client_orgs')
        .update(updateData)
        .eq('org_id', orgId)
        .select()
        .single();

      const { data, error } = await Promise.race([updatePromise, timeoutPromise]);

      if (error) {
        console.error('Error updating organization:', error);
        if (error.code === '23505') { // Unique constraint violation
          throw new Error(`Organization code '${updates.org_code}' already exists`);
        }
        throw error;
      }

      console.log('Organization updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Error updating organization:', error);
      throw new Error(`Failed to update organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async deleteOrganization(orgId: number): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock deletion for demo mode
      return;
    }

    try {
      console.log('Deleting organization:', orgId);
      
      // Check if organization has users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('org_id', orgId)
        .limit(1);

      if (usersError) {
        console.error('Error checking organization users:', usersError);
        throw usersError;
      }

      if (users && users.length > 0) {
        throw new Error('Cannot delete organization that has users. Please reassign or delete users first.');
      }

      const { error } = await supabase
        .from('client_orgs')
        .delete()
        .eq('org_id', orgId);

      if (error) {
        console.error('Error deleting organization:', error);
        throw error;
      }

      console.log('Organization deleted successfully');
    } catch (error) {
      console.error('Error deleting organization:', error);
      throw new Error(`Failed to delete organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getOrganizationByCode(orgCode: string): Promise<Organization | null> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock lookup for demo mode
      const orgs = await this.getOrganizations();
      return orgs.find(org => org.org_code === orgCode.toUpperCase()) || null;
    }

    try {
      console.log('Fetching organization by code:', orgCode);
      
      const { data, error } = await supabase
        .from('client_orgs')
        .select('*')
        .eq('org_code', orgCode.toUpperCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows returned
        }
        console.error('Error fetching organization by code:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching organization by code:', error);
      throw new Error('Failed to fetch organization');
    }
  }
}