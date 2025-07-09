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
    try {
      console.log('Loading user profile for:', userId);
      
      // First try to find user in admin_users table
      const { data: adminProfile, error: adminError } = await supabase!
        .from('admin_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (adminProfile) {
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
      const { data: clientProfile, error: clientError } = await supabase!
        .from('client_users')
        .select('*, client_orgs(org_code, org_name)')
        .eq('id', userId)
        .maybeSingle();

      if (clientProfile) {
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
      console.error('User profile not found in admin_users or client_users tables');
      // Don't throw error immediately, user might be newly created
      console.log('User profile not found, this might be a newly created user');

    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      // Don't throw error, just log it
      console.log('Will retry loading user profile...');
    }
  };

  const checkUser = async () => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserProfile(session.user.id);
        }
      } catch (error) {
        console.error('Error checking user session:', error);
      }
    }
    setLoading(false);
  };

  const login = async (orgCode: string, email: string, password: string) => {
    if (isSupabaseConfigured() && supabase) {
      setLoading(true);
      
      // Handle ADMIN org code differently
      if (orgCode.toUpperCase() === 'ADMIN') {
        // Authenticate with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          throw new Error(error.message);
        }
        
        if (data.user) {
          // Check if user exists in admin_users table
          const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', data.user.id)
            .single();
          
          if (adminError || !adminUser) {
            await supabase.auth.signOut(); // Sign out if not an admin user
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
          throw new Error('Invalid organization code');
        }
        
        // Authenticate with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          throw new Error(error.message);
        }
        
        if (data.user) {
          // Check if user exists in client_users table with correct org_id
          const { data: clientUser, error: clientError } = await supabase
            .from('client_users')
            .select('*')
            .eq('id', data.user.id)
            .eq('org_id', orgData.org_id)
            .single();
          
          if (clientError || !clientUser) {
            await supabase.auth.signOut(); // Sign out if user not found for this org
            throw new Error('User not found for this organization');
          }
          
          await loadUserProfile(data.user.id);
        }
      }
      
      setLoading(false);
    } else {
      // Mock authentication for demo
      const foundUser = mockUsers.find(u => u.email === email && u.orgCode === orgCode.toUpperCase());
      if (foundUser && password === 'demo123') {
        setUser(foundUser);
      } else {
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