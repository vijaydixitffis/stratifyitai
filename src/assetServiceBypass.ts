import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Asset } from './types';

// Check if user is admin by querying admin_users table directly
async function isUserAdmin(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in isUserAdmin:', error);
    return false;
  }
}

// Alternative asset fetching that bypasses RLS for admin users
export async function getAssetsBypassRLS(org_id?: number): Promise<Asset[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.log('Using mock data - Supabase not configured');
    return [];
  }

  try {
    console.log('Fetching assets with bypass approach...');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No authenticated user');
    }

    // Check if user is admin
    const admin = await isUserAdmin(session.user.id);
    console.log('User admin status:', admin);

    if (admin) {
      // For admin users, try to fetch all assets
      // First try with a simple query that might bypass RLS
      console.log('Admin user detected, attempting to fetch all assets...');

      // Try a direct query without RLS filtering
      const { data, error } = await supabase
        .from('it_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all assets for admin:', error);

        // If that fails, try with org_id filter
        if (org_id) {
          console.log('Trying with org_id filter:', org_id);
          const { data: filteredData, error: filteredError } = await supabase
            .from('it_assets')
            .select('*')
            .eq('org_id', org_id)
            .order('created_at', { ascending: false });

          if (filteredError) {
            throw new Error(`Failed to fetch assets: ${filteredError.message}`);
          }

          return filteredData || [];
        }

        throw new Error(`Failed to fetch assets: ${error.message}`);
      }

      console.log('Successfully fetched assets for admin:', data?.length || 0);
      return data || [];
    } else {
      // For client users, use the normal approach with org_id filter
      let query = supabase!
        .from('it_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (org_id) {
        query = query.eq('org_id', org_id);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch assets: ${error.message}`);
      }

      return data || [];
    }

  } catch (error) {
    console.error('Error in getAssetsBypassRLS:', error);
    throw error;
  }
}
