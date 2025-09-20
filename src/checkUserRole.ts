import { supabase, isSupabaseConfigured } from './lib/supabase';

export async function checkUserRole() {
  if (!isSupabaseConfigured() || !supabase) {
    console.log('Supabase not configured');
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.log('No user session');
      return;
    }

    console.log('🔍 Checking user role for:', session.user.id);

    // Check unified users table for user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (userError) {
      console.error('Error checking users table:', userError);
    } else if (userData) {
      console.log('✅ User found in unified users table:', userData);
      console.log('Role from users table:', userData.role);
      console.log('Organization:', userData.organization);
      console.log('Org ID:', userData.org_id);
    } else {
      console.log('❌ User not found in users table');
    }

    // Test JWT payload
    if (session.access_token) {
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        console.log('JWT Payload:', payload);
        console.log('JWT role:', payload.role);
        console.log('JWT user_metadata:', payload.user_metadata);
        console.log('JWT app_metadata:', payload.app_metadata);
      } catch (e) {
        console.error('Error parsing JWT:', e);
      }
    }

  } catch (error) {
    console.error('Error in checkUserRole:', error);
  }
}

// Auto-run the check
if (typeof window !== 'undefined') {
  // Wait a bit for auth to initialize
  setTimeout(() => {
    checkUserRole();
  }, 2000);
}
