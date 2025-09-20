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
    role: 'admin-consultant',
    organization: 'StratifyIT.ai',
    orgCode: 'ADMIN'
  },
  {
    id: '4',
    name: 'Lisa Rodriguez',
    email: 'lisa@stratifyit.ai',
    role: 'admin-architect',
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
            // Try to load from both admin and client tables
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
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile loading timeout after 10 seconds')), 10000);
    });

    try {
      console.log('Loading user profile for:', userId);
      
      // First try to find user in admin_users table
      console.log('Checking admin_users table...');
      
      const adminQueryPromise = supabase!
        .from('admin_users')
        .select('*')
        .eq('id', userId)
        .single();
      
      const { data: adminProfile, error: adminError } = await Promise.race([
        adminQueryPromise,
        timeoutPromise
      ]) as any;

      console.log('Admin query result:', { adminProfile, adminError });

      if (adminProfile && !adminError) {
        // User is an admin
        const appUser: User = {
          id: adminProfile.id,
          name: adminProfile.name,
          email: adminProfile.email || '',
          role: adminProfile.role,
          organization: 'StratifyIT.ai',
          orgCode: 'ADMIN'
        };
        setUser(appUser);
        console.log('Admin user profile loaded successfully:', appUser.name);
        return;
      }

      // If not found in admin_users, try client_users
      console.log('Checking client_users table...');
      
      const clientQueryPromise = supabase!
        .from('client_users')
        .select('*, client_orgs(org_code, org_name)')
        .eq('id', userId)
        .single();
      
      const { data: clientProfile, error: clientError } = await Promise.race([
        clientQueryPromise,
        timeoutPromise
      ]) as any;

      console.log('Client query result:', { clientProfile, clientError });

      if (clientProfile && !clientError) {
        // User is a client
        const appUser: User = {
          id: clientProfile.id,
          name: clientProfile.name,
          email: clientProfile.email || '',
          role: clientProfile.role,
          organization: clientProfile.client_orgs?.org_name || clientProfile.organization,
          orgCode: clientProfile.client_orgs?.org_code,
          org_id: clientProfile.org_id
        };
        setUser(appUser);
        console.log('Client user profile loaded successfully:', appUser.name);
        return;
      }

      // If user not found in either table
      console.error('User profile not found in admin_users or client_users tables for user:', userId);
      console.error('Admin error:', adminError);
      console.error('Client error:', clientError);
      
      // Set user to null if profile not found
      console.log('User profile not found, signing out...');
      setUser(null);
      if (supabase) {
        await supabase.auth.signOut();
      }

    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      
      if (error instanceof Error && error.message.includes('timeout')) {
        console.error('Profile loading timed out - this may indicate RLS policy issues');
      }
      
      setUser(null);
      if (supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      console.log('Profile loading completed, setting loading to false');
      setLoading(false);
    }
  };

  const checkUser = async () => {
    console.log('Checking user session...');
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session check result:', session?.user?.id || 'No session');
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          console.log('No active session found');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking user session:', error);
        setLoading(false);
      }
    } else {
      console.log('Supabase not configured, using mock mode');
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
            const { data: adminUser, error: adminError } = await supabase
              .from('admin_users')
              .select('*')
              .eq('id', data.user.id)
              .single();
            if (adminError || !adminUser) {
              await supabase.auth.signOut();
              setUser(null);
              throw new Error('Access denied. Admin credentials required.');
            }
            await loadUserProfile(data.user.id);
          }
        } else {
          // Validate org code from client_orgs for client users
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
            const { data: clientUser, error: clientError } = await supabase
              .from('client_users')
              .select('*')
              .eq('id', data.user.id)
              .eq('org_id', orgData.org_id)
              .single();
            if (clientError || !clientUser) {
              await supabase.auth.signOut();
              setUser(null);
              throw new Error('User not found for this organization.');
            }
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