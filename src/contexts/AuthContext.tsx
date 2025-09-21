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
  isInitialized: boolean; // Add this to track when auth is fully initialized
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

  useEffect(() => {
    console.log('AuthProvider: Initializing authentication...');

    // Listen for auth changes if Supabase is configured
    if (isSupabaseConfigured() && supabase) {
      // Check if user is already logged in first
      checkUser();
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state change event:', event, 'Session:', session?.user?.id || 'none');
          console.log('AuthProvider: Auth state change - loading:', loading, 'isInitialized:', isInitialized, 'user:', user?.id || 'none');

          if (session?.user) {
            // Try to load user profile
            await loadUserProfile(session.user.id);
          } else {
            // Explicitly handle no session case
            console.log('Auth state change: No session found, clearing user state');
            setUser(null);
            setLoading(false);
            setIsInitialized(true);
          }
        }
      );

      return () => subscription.unsubscribe();
    } else {
      console.log('AuthProvider: Supabase not configured, using demo mode');
      // For demo mode, still check for any existing session
      checkUser();
      setLoading(false);
      setIsInitialized(true);
    }
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('AuthProvider: Loading user profile for:', userId);
      
      // Get current session and extract user data
      const { data: session } = await supabase!.auth.getSession();
      console.log('AuthProvider: Got session data:', session?.session?.user?.id || 'no session');
      
      if (session?.session?.user) {
        const authUser = session.session.user;
        console.log('AuthProvider: Processing auth user:', authUser.id, authUser.email);
        
        const appUser: User = {
          id: authUser.id,
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Unknown User',
          email: authUser.email || '',
          role: authUser.user_metadata?.role || 'client-manager',
          organization: authUser.user_metadata?.organization || 'Unknown Organization',
          orgCode: authUser.user_metadata?.orgCode || (authUser.user_metadata?.role === 'admin' ? 'ADMIN' : 'UNKNOWN'),
          org_id: authUser.user_metadata?.org_id || undefined
        };
        
        console.log('AuthProvider: Setting user:', appUser.name, appUser.role);
        setUser(appUser);
        setLoading(false);
        setIsInitialized(true);
        console.log('AuthProvider: User loaded successfully:', appUser.name);
      } else {
        console.log('AuthProvider: No session found, setting user to null');
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('AuthProvider: Error in loadUserProfile:', error);
      setUser(null);
      setLoading(false);
      setIsInitialized(true);
    }
  };

  const checkUser = async () => {
    console.log('AuthProvider: Checking user session...');
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('AuthProvider: Session check result:', session?.user?.id || 'no session', error);

        if (error) {
          console.error('AuthProvider: Error checking session:', error);
          setLoading(false);
          setIsInitialized(true);
          return;
        }

        if (session?.user) {
          // Load user profile from session data
          await loadUserProfile(session.user.id);
        } else {
          // Explicitly handle no session case
          console.log('AuthProvider: No session found during check, setting up for login');
          setUser(null);
          setLoading(false);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('AuthProvider: Error checking user session:', error);
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
      }
    } else {
      console.log('AuthProvider: Demo mode - no session check needed');
      setLoading(false);
      setIsInitialized(true);
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
    <AuthContext.Provider value={{ user, login, logout, isClient, isAdmin, loading, isInitialized }}>
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