import { supabase, isSupabaseConfigured } from './lib/supabase';

export async function debugJWT() {
  if (!isSupabaseConfigured() || !supabase) {
    console.log('Supabase not configured');
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.log('No access token found');
      return;
    }

    // Decode JWT payload
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    console.log('JWT Payload:', payload);

    // Check user metadata
    console.log('User metadata:', session.user?.user_metadata);
    console.log('App metadata:', session.user?.app_metadata);

  } catch (error) {
    console.error('Error debugging JWT:', error);
  }
}

// Auto-run when module is loaded
if (typeof window !== 'undefined') {
  debugJWT();
}
