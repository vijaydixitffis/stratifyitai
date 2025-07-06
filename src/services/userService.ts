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
          status: 'active'
        }
      ];
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Map the database fields to our interface
      return (data || []).map(user => ({
        ...user,
        orgCode: user.org_code, // Map org_code to orgCode for consistency
        org_id: user.org_id
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
        status: 'active'
      };
      return newUser;
    }

    try {
      // Use signUp instead of admin.createUser for now
      // In production, this should be handled by a serverless function
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
        throw error;
      }

      if (!data.user) {
        throw new Error('Failed to create user');
      }

      // The profile should be created automatically by the trigger
      // Return a mock profile for now
      const newUser: UserProfile = {
        id: data.user.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        organization: userData.organization,
        orgCode: userData.orgCode,
        org_id: userData.org_id,
        created_at: new Date().toISOString(),
        status: 'active'
      };

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user. Admin user creation requires proper server-side setup.');
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
        created_at: new Date().toISOString(),
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
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.org_id !== undefined) updateData.org_id = updates.org_id;

      // Only proceed with main update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        const { data, error } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      } else {
        // If no main fields to update, just return the current user data
        const { data, error } = await supabase
          .from('user_profiles')
          .select()
          .eq('id', userId)
          .single();

        if (error) {
          throw error;
        }

        return data;
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
      // For now, just mark as inactive since Admin API requires service role
      const { error } = await supabase
        .from('user_profiles')
        .update({ status: 'inactive' })
        .eq('id', userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user. Admin user deletion requires proper server-side setup.');
    }
  }
} 