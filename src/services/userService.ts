import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: 'client-manager' | 'client-architect' | 'client-cxo' | 'admin-consultant' | 'admin-architect' | 'admin-super';
  organization: string;
  orgCode?: string;
  org_id?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'client-manager' | 'client-architect' | 'client-cxo' | 'admin-consultant' | 'admin-architect' | 'admin-super';
  organization: string;
  orgCode?: string;
  org_id?: number;
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
}

export class UserService {
  static async getUsers(): Promise<UserProfile[]> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock data for demo mode
      return [
        {
          id: '1',
          name: 'John Smith',
          email: 'john@company.com',
          role: 'client-manager',
          organization: 'TechCorp Inc.',
          orgCode: 'TECH1',
          org_id: 1,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
          status: 'active'
        },
        {
          id: '2',
          name: 'Sarah Johnson',
          email: 'sarah@company.com',
          role: 'client-architect',
          organization: 'TechCorp Inc.',
          orgCode: 'TECH1',
          org_id: 1,
          created_at: '2024-01-16T14:30:00Z',
          updated_at: '2024-01-16T14:30:00Z',
          status: 'active'
        },
        {
          id: '3',
          name: 'Mike Chen',
          email: 'mike@stratifyit.ai',
          role: 'admin-consultant',
          organization: 'StratifyIT.ai',
          orgCode: 'STRAT',
          org_id: 2,
          created_at: '2024-01-10T09:15:00Z',
          updated_at: '2024-01-10T09:15:00Z',
          status: 'active'
        },
        {
          id: '4',
          name: 'Lisa Rodriguez',
          email: 'lisa@stratifyit.ai',
          role: 'admin-architect',
          organization: 'StratifyIT.ai',
          orgCode: 'STRAT',
          org_id: 2,
          created_at: '2024-01-12T11:45:00Z',
          updated_at: '2024-01-12T11:45:00Z',
          status: 'active'
        }
      ];
    }

    try {
      // Join with organizations to get org_code
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          organizations!user_profiles_org_id_fkey (
            org_code,
            org_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      // Map the database fields to our interface
      return (data || []).map(user => ({
        id: user.id,
        name: user.name,
        email: user.email || '',
        role: user.role,
        organization: user.organization,
        orgCode: user.organizations?.org_code,
        org_id: user.org_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        status: 'active' // Default to active since we don't have a status field yet
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  static async createUser(userData: CreateUserRequest): Promise<UserProfile> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock creation for demo mode
      const newUser: UserProfile = {
        id: Date.now().toString(),
        name: userData.name,
        email: userData.email,
        role: userData.role,
        organization: userData.organization,
        orgCode: userData.orgCode,
        org_id: userData.org_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active'
      };
      return newUser;
    }

    try {
      console.log('Creating user with data:', userData);
      
      // Create user with metadata that will be used by the trigger
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: userData.role,
            organization: userData.organization,
            orgCode: userData.orgCode,
            org_id: userData.org_id
          }
        }
      });

      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      if (!data.user) {
        throw new Error('Failed to create user - no user returned');
      }

      console.log('User created successfully:', data.user.id);

      // Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Fetch the created profile to return
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          organizations!user_profiles_org_id_fkey (
            org_code,
            org_name
          )
        `)
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching created profile:', profileError);
        // Return a constructed profile if we can't fetch it
        return {
          id: data.user.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          organization: userData.organization,
          orgCode: userData.orgCode,
          org_id: userData.org_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active'
        };
      }

      return {
        id: profile.id,
        name: profile.name,
        email: profile.email || userData.email,
        role: profile.role,
        organization: profile.organization,
        orgCode: profile.organizations?.org_code,
        org_id: profile.org_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        status: 'active'
      };

    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock update for demo mode
      const updatedUser: UserProfile = {
        id: userId,
        name: updates.name || '',
        email: updates.email || '',
        role: updates.role || 'client-manager',
        organization: updates.organization || '',
        orgCode: updates.orgCode,
        org_id: updates.org_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: updates.status || 'active'
      };
      return updatedUser;
    }

    try {
      // Only update fields that we know exist in the database
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.role !== undefined) updateData.role = updates.role;
      if (updates.organization !== undefined) updateData.organization = updates.organization;
      if (updates.org_id !== undefined) updateData.org_id = updates.org_id;
      if (updates.email !== undefined) updateData.email = updates.email;

      // Only proceed with update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        const { data, error } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', userId)
          .select(`
            *,
            organizations!user_profiles_org_id_fkey (
              org_code,
              org_name
            )
          `)
          .single();

        if (error) {
          console.error('Error updating user:', error);
          throw error;
        }

        return {
          id: data.id,
          name: data.name,
          email: data.email || '',
          role: data.role,
          organization: data.organization,
          orgCode: data.organizations?.org_code,
          org_id: data.org_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
          status: 'active'
        };
      } else {
        // If no main fields to update, just return the current user data
        const { data, error } = await supabase
          .from('user_profiles')
          .select(`
            *,
            organizations!user_profiles_org_id_fkey (
              org_code,
              org_name
            )
          `)
          .eq('id', userId)
          .single();

        if (error) {
          throw error;
        }

        return {
          id: data.id,
          name: data.name,
          email: data.email || '',
          role: data.role,
          organization: data.organization,
          orgCode: data.organizations?.org_code,
          org_id: data.org_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
          status: 'active'
        };
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  static async deleteUser(userId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      // Mock deletion for demo mode
      return;
    }

    try {
      // Delete the user profile (this will also handle auth user deletion via cascade if set up)
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user profile:', error);
        throw error;
      }

      // Note: In production, you might want to use the Admin API to delete the auth user as well
      // This requires service role key and should be done in a serverless function
      
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }
}