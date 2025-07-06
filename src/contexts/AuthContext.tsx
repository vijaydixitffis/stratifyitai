import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role?: string, organization?: string) => Promise<void>;
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
    organization: 'TechCorp Inc.'
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah@company.com',
    role: 'client-architect',
    organization: 'TechCorp Inc.'
  },
  {
    id: '3',
    name: 'Mike Chen',
    email: 'mike@stratifyit.ai',
    role: 'admin-consultant',
    organization: 'StratifyIT.ai'
  },
  {
    id: '4',
    name: 'Lisa Rodriguez',
    email: 'lisa@stratifyit.ai',
    role: 'admin-architect',
    organization: 'StratifyIT.ai'
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

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase!
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      if (profile) {
        const appUser: User = {
          id: profile.id,
          name: profile.name,
          email: '', // We'll get this from auth.users if needed
          role: profile.role,
          organization: profile.organization
        };
        setUser(appUser);
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

  const login = async (email: string, password: string) => {
    if (isSupabaseConfigured() && supabase) {
      // Use Supabase authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        await loadUserProfile(data.user.id);
      }
    } else {
      // Mock authentication for demo
      const foundUser = mockUsers.find(u => u.email === email);
      if (foundUser && password === 'demo123') {
        setUser(foundUser);
      } else {
        throw new Error('Invalid credentials. Use demo123 as password for demo accounts.');
      }
    }
  };

  const signup = async (
    email: string, 
    password: string, 
    name: string, 
    role: string = 'client-manager',
    organization: string = 'Default Organization'
  ) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Signup is only available when connected to Supabase');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          organization
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      // Profile will be created automatically by the trigger
      await loadUserProfile(data.user.id);
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
    <AuthContext.Provider value={{ user, login, signup, logout, isClient, isAdmin, loading }}>
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