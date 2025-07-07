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
    orgCode: 'STRAT'
  },
  {
    id: '4',
    name: 'Lisa Rodriguez',
    email: 'lisa@stratifyit.ai',
    role: 'admin-architect',
    organization: 'StratifyIT.ai',
    orgCode: 'STRAT'
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

  const loadUserProfile = async (userId: string, orgCode?: string) => {
    // Prevent loading if user is already loaded with the same ID
    if (user?.id === userId) {
      console.log('User profile already loaded for:', userId);
      return;
    }

    try {
      console.log('Loading user profile for:', userId);
      let profile = null;
      if (orgCode && orgCode.toUpperCase() === 'ADMIN') {
        // Fetch from admin_users (NO join)
        const { data, error } = await supabase!
          .from('admin_users')
          .select('*')
          .eq('id', userId)
          .single();
        if (error) throw error;
        profile = data;
        if (profile) {
          const appUser: User = {
            id: profile.id,
            name: profile.name,
            email: profile.email || '',
            role: profile.role,
            organization: 'Admin',
            orgCode: 'ADMIN',
            org_id: profile.org_id
          };
          setUser(appUser);
          console.log('User profile loaded successfully:', appUser.name);
        }
        return;
      } else {
        // Fetch from client_users and join client_orgs
        const { data, error } = await supabase!
          .from('client_users')
          .select('*, client_orgs(org_code, org_name)')
          .eq('id', userId)
          .single();
        if (error) throw error;
        profile = data;
      }
      if (profile) {
        const appUser: User = {
          id: profile.id,
          name: profile.name,
          email: profile.email || '',
          role: profile.role,
          organization: profile.client_orgs?.org_name || profile.organization,
          orgCode: profile.client_orgs?.org_code || profile.orgCode,
          org_id: profile.org_id
        };
        setUser(appUser);
        console.log('User profile loaded successfully:', appUser.name);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
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
      let org = null;
      if (orgCode.toUpperCase() !== 'ADMIN') {
        // Validate org code from client_orgs
        const { data: orgData, error: orgError } = await supabase
          .from('client_orgs')
          .select('*')
          .eq('org_code', orgCode.toUpperCase())
          .single();
        if (orgError || !orgData) {
          throw new Error('Invalid organization code');
        }
        org = orgData;
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
        if (orgCode.toUpperCase() === 'ADMIN') {
          // Fetch from admin_users
          const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', data.user.id)
            .single();
          if (adminError || !adminUser) {
            throw new Error('Admin user not found');
          }
          await loadUserProfile(data.user.id, 'ADMIN');
        } else {
          // Fetch from client_users with org_id
          const { data: clientUser, error: clientError } = await supabase
            .from('client_users')
            .select('*')
            .eq('id', data.user.id)
            .eq('org_id', org.org_id)
            .single();
          if (clientError || !clientUser) {
            throw new Error('Client user not found for this organization');
          }
          await loadUserProfile(data.user.id);
        }
      }
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