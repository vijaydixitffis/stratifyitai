import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (orgCode: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isClient: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demonstration when Supabase is not configured
const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john@company.com',
    role: 'client-manager',
    organization: 'TechCorp Inc.',
    orgCode: 'TECH1'
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah@company.com',
    role: 'client-architect',
    organization: 'TechCorp Inc.',
    orgCode: 'TECH1'
  },
  {
    id: '3',
    name: 'Mike Chen',
    email: 'mike@stratifyit.ai',
    role: 'admin',
    organization: 'StratifyIT.ai',
    orgCode: 'ADMIN'
  },
  {
    id: '4',
    name: 'Lisa Rodriguez',
    email: 'lisa@stratifyit.ai',
    role: 'admin',
    organization: 'StratifyIT.ai',
    orgCode: 'ADMIN'
  }
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    checkUser();

    // Listen for auth changes if Supabase is configured
    if (isSupabaseConfigured() && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state change:', event, session?.user?.id);
          if (session?.user) {
            // Try to load user profile
            await loadUserProfile(session.user.id);
          } else {
            setUser(null);
          }
          setLoading(false);
        }
      );

      return () => subscription.unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('Loading user profile for:', userId);

      // Try to create/get user profile using the database function
      // This will create a profile if it doesn't exist
      const { data: profileData, error: profileError } = await supabase!
        .rpc('create_current_user_profile');

      if (profileData && !profileError) {
        console.log('User profile created/retrieved successfully:', profileData);

        // If profile was just created, fetch the full profile data
        if (profileData.exists === true) {
          // Profile already existed, fetch it
          const { data: userProfile, error: fetchError } = await supabase!
            .from('users')
            .select('id, name, email, role, org_id, organization')
            .eq('id', userId)
            .maybeSingle();

          if (userProfile && !fetchError) {
            const appUser: User = {
              id: userProfile.id,
              name: userProfile.name,
              email: userProfile.email || '',
              role: userProfile.role,
              organization: userProfile.organization || 'Unknown Organization',
              orgCode: userProfile.role === 'admin' ? 'ADMIN' : 'UNKNOWN',
              org_id: userProfile.org_id || undefined
            };
            setUser(appUser);
            console.log('User profile loaded successfully:', appUser.name);
            return;
          }
        } else {
          // Profile was just created, use the returned data
          const appUser: User = {
            id: profileData.id,
            name: profileData.name,
            email: profileData.email || '',
            role: profileData.role,
            organization: profileData.organization || 'Unknown Organization',
            orgCode: profileData.role === 'admin' ? 'ADMIN' : 'UNKNOWN',
            org_id: profileData.org_id || undefined
          };
          setUser(appUser);
          console.log('User profile created successfully:', appUser.name);
          return;
        }
      }

      console.log('Failed to create/retrieve user profile:', profileError);

      // Fallback: Try to load existing profile directly
      const { data: userProfile, error: fetchError } = await supabase!
        .from('users')
        .select('id, name, email, role, org_id, organization')
        .eq('id', userId)
        .maybeSingle();

      if (userProfile && !fetchError) {
        console.log('Found existing user profile, setting user data...');
        const appUser: User = {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email || '',
          role: userProfile.role,
          organization: userProfile.organization || 'Unknown Organization',
          orgCode: userProfile.role === 'admin' ? 'ADMIN' : 'UNKNOWN',
          org_id: userProfile.org_id || undefined
        };
        setUser(appUser);
        console.log('User profile loaded successfully:', appUser.name);
        return;
      }

      console.log('User profile not found yet, trigger might still be processing...');
      console.log('Profile error:', profileError);
      console.log('Fetch error:', fetchError);

      // Wait a moment and try again (trigger might still be processing)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: retryProfile, error: retryError } = await supabase!
        .from('users')
        .select('id, name, email, role, org_id, organization')
        .eq('id', userId)
        .maybeSingle();

      if (retryProfile && !retryError) {
        console.log('Found user profile on retry, setting user data...');
        const appUser: User = {
          id: retryProfile.id,
          name: retryProfile.name,
          email: retryProfile.email || '',
          role: retryProfile.role,
          organization: retryProfile.organization || 'Unknown Organization',
          orgCode: retryProfile.role === 'admin' ? 'ADMIN' : 'UNKNOWN',
          org_id: retryProfile.org_id || undefined
        };
        setUser(appUser);
        console.log('User profile loaded on retry:', appUser.name);
        return;
      }

      console.log('User profile still not found after retry, attempting to create basic profile...');

      // Auto-create basic profile if user doesn't exist
      try {
        console.log('Attempting to create missing user profile...');
        // TODO: Implement user profile auto-creation logic here
        setLoading(false);
      } catch (error) {
        console.error('Error in loadUserProfile:', error);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      setLoading(false);
    }
  };

  const checkUser = async () => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Use the new loadUserProfile function which will create profile if needed
          await loadUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking user session:', error);
        setLoading(false); // Always set loading to false to prevent hanging
      }
    } else {
      setLoading(false);
    }
  };

  const login = async (orgCode: string, email: string, password: string) => {
    if (isSupabaseConfigured() && supabase) {
      try {
        // Handle ADMIN org code differently
        if (orgCode.toUpperCase() === 'ADMIN') {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            setUser(null);
            throw new Error('Invalid email or password. Please try again.');
          }
          if (data.user) {
            // For admin users, we don't need to check role immediately
            // The trigger function will create the profile automatically
            console.log('Admin login successful, profile will be created by trigger');
            await loadUserProfile(data.user.id);
          }
        } else {
          // For client users, just validate org code exists
          const { data: orgData, error: orgError } = await supabase
            .from('client_orgs')
            .select('*')
            .eq('org_code', orgCode.toUpperCase())
            .single();
          if (orgError || !orgData) {
            setUser(null);
            throw new Error('Invalid organization code.');
          }
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            setUser(null);
            throw new Error('Invalid email or password. Please try again.');
          }
          if (data.user) {
            console.log('Client login successful, profile will be created by trigger');
            await loadUserProfile(data.user.id);
          }
        }
      } catch (error) {
        setUser(null);
        if (error instanceof Error) {
          throw new Error(error.message || 'Login failed. Please check your credentials.');
        } else {
          throw new Error('Login failed. Please check your credentials.');
        }
      }
    } else {
      // Mock authentication for demo
      const foundUser = mockUsers.find(u => u.email === email && u.orgCode === orgCode.toUpperCase());
      if (foundUser && password === 'demo123') {
        setUser(foundUser);
      } else {
        setUser(null);
        throw new Error('Invalid credentials. Use demo123 as password for demo accounts.');
      }
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  const isClient = user?.role.startsWith('client') || false;
  const isAdmin = user?.role.startsWith('admin') || false;

  return (
    <AuthContext.Provider value={{ user, login, logout, isClient, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};