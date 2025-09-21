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
  isInitialized: boolean;
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state
  useEffect(() => {
    console.log('AuthProvider: Starting initialization...');
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    console.log('AuthProvider: Initializing auth state...');
    
    if (!isSupabaseConfigured() || !supabase) {
      console.log('AuthProvider: Supabase not configured, using demo mode');
      setLoading(false);
      setIsInitialized(true);
      return;
    }

    try {
      // Check current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('AuthProvider: Error getting session:', error);
        setUser(null);
      } else if (session?.user) {
        console.log('AuthProvider: Found existing session for user:', session.user.id);
        await processUser(session.user);
      } else {
        console.log('AuthProvider: No existing session found');
        setUser(null);
      }

      // Set up auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('AuthProvider: Auth state changed:', event);
          
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('AuthProvider: User signed in:', session.user.id);
            await processUser(session.user);
          } else if (event === 'SIGNED_OUT') {
            console.log('AuthProvider: User signed out');
            setUser(null);
          }
        }
      );

      // Cleanup subscription on unmount
      return () => {
        console.log('AuthProvider: Cleaning up auth subscription');
        subscription.unsubscribe();
      };

    } catch (error) {
      console.error('AuthProvider: Error during initialization:', error);
      setUser(null);
    } finally {
      setLoading(false);
      setIsInitialized(true);
      console.log('AuthProvider: Initialization complete');
    }
  };

  const processUser = async (authUser: any) => {
    try {
      console.log('AuthProvider: Processing user:', authUser.id, authUser.email);
      
      // Extract user data from auth user metadata
      const userData = authUser.user_metadata || {};
      
      const appUser: User = {
        id: authUser.id,
        name: userData.name || authUser.email?.split('@')[0] || 'Unknown User',
        email: authUser.email || '',
        role: userData.role || 'client-manager',
        organization: userData.organization || 'Unknown Organization',
        orgCode: userData.orgCode || (userData.role === 'admin' ? 'ADMIN' : 'UNKNOWN'),
        org_id: userData.org_id || undefined
      };
      
      console.log('AuthProvider: Setting user data:', appUser.name, appUser.role, appUser.orgCode);
      setUser(appUser);
      
    } catch (error) {
      console.error('AuthProvider: Error processing user:', error);
      setUser(null);
    }
  };

  const login = async (orgCode: string, email: string, password: string) => {
    console.log('AuthProvider: Login attempt for:', email, 'org:', orgCode);
    
    if (!isSupabaseConfigured() || !supabase) {
      // Mock authentication for demo
      const foundUser = mockUsers.find(u => u.email === email && u.orgCode === orgCode.toUpperCase());
      if (foundUser && password === 'demo123') {
        console.log('AuthProvider: Demo login successful for:', foundUser.name);
        setUser(foundUser);
        return;
      } else {
        throw new Error('Invalid credentials. Use demo123 as password for demo accounts.');
      }
    }

    try {
      // Validate organization code for non-admin users
      if (orgCode.toUpperCase() !== 'ADMIN') {
        console.log('AuthProvider: Validating org code:', orgCode);
        const { data: orgData, error: orgError } = await supabase
          .from('client_orgs')
          .select('org_id, org_name')
          .eq('org_code', orgCode.toUpperCase())
          .single();
          
        if (orgError || !orgData) {
          console.error('AuthProvider: Invalid org code:', orgCode, orgError);
          throw new Error('Invalid organization code.');
        }
        console.log('AuthProvider: Org validation successful:', orgData.org_name);
      }

      // Attempt login
      console.log('AuthProvider: Attempting Supabase login...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('AuthProvider: Login error:', error);
        throw new Error('Invalid email or password. Please try again.');
      }

      if (!data.user) {
        console.error('AuthProvider: No user returned from login');
        throw new Error('Login failed - no user data returned.');
      }

      console.log('AuthProvider: Login successful for user:', data.user.id);
      // User will be processed by the auth state change listener
      
    } catch (error) {
      console.error('AuthProvider: Login failed:', error);
      setUser(null);
      throw error;
    }
  };

  const logout = async () => {
    console.log('AuthProvider: Logging out...');
    
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
        console.log('AuthProvider: Supabase logout successful');
      } catch (error) {
        console.error('AuthProvider: Error during logout:', error);
      }
    }
    
    setUser(null);
    console.log('AuthProvider: User cleared');
  };

  const isClient = user?.role?.startsWith('client') || false;
  const isAdmin = user?.role?.startsWith('admin') || false;

  const contextValue = {
    user,
    login,
    logout,
    isClient,
    isAdmin,
    loading,
    isInitialized
  };

  console.log('AuthProvider: Rendering with state:', {
    hasUser: !!user,
    loading,
    isInitialized,
    userRole: user?.role || 'none'
  });

  return (
    <AuthContext.Provider value={contextValue}>
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