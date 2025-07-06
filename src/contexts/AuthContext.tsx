import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
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
            // Convert Supabase user to our User type
            const appUser: User = {
              id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
              email: session.user.email || '',
              role: session.user.user_metadata?.role || 'client-manager',
              organization: session.user.user_metadata?.organization || 'Default Organization'
            };
            setUser(appUser);
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

  const checkUser = async () => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const appUser: User = {
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: session.user.user_metadata?.role || 'client-manager',
            organization: session.user.user_metadata?.organization || 'Default Organization'
          };
          setUser(appUser);
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
        const appUser: User = {
          id: data.user.id,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          email: data.user.email || '',
          role: data.user.user_metadata?.role || 'client-manager',
          organization: data.user.user_metadata?.organization || 'Default Organization'
        };
        setUser(appUser);
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