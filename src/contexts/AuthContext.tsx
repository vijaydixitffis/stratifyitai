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

    // Check if user is already logged in
    checkUser();

    // Listen for auth changes if Supabase is configured
    if (isSupabaseConfigured() && supabase) {
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
      setLoading(false);
      setIsInitialized(true);
    }
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('AuthProvider: Loading user profile for:', userId);
      
      let profileLoadCompleted = false;
      
      // Set a shorter timeout to prevent hanging with immediate fallback
      const timeoutId = setTimeout(() => {
        if (!profileLoadCompleted) {
          console.warn('AuthProvider: User profile loading timeout, switching to fallback');
          
          // Immediate fallback to auth session data
          supabase!.auth.getSession().then(({ data: session }) => {
            if (session?.session?.user && !profileLoadCompleted) {
              const authUser = session.session.user;
              const appUser: User = {
                id: authUser.id,
                name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Unknown User',
                email: authUser.email || '',
                role: 'client-manager', // Default role
                organization: 'Unknown Organization',
                orgCode: 'UNKNOWN'
              };
              setUser(appUser);
              setLoading(false);
              setIsInitialized(true);
              profileLoadCompleted = true;
              console.log('AuthProvider: Set user from timeout fallback:', appUser.name);
            } else if (!profileLoadCompleted) {
              // Final fallback if no session
              setUser(null);
              setLoading(false);
              setIsInitialized(true);
              profileLoadCompleted = true;
              console.log('AuthProvider: Timeout fallback - no session, setting user to null');
            }
          }).catch((fallbackError) => {
            console.error('AuthProvider: Timeout fallback failed:', fallbackError);
            if (!profileLoadCompleted) {
              setUser(null);
              setLoading(false);
              setIsInitialized(true);
              profileLoadCompleted = true;
            }
          });
        }
      }, 3000); // Reduced to 3 seconds for faster fallback

      // Try to create/get user profile using the database function
      // This will create a profile if it doesn't exist
      try {
        const { data: profileData, error: profileError } = await supabase!
          .rpc('create_current_user_profile');

        if (profileLoadCompleted) return;
        
        if (profileData && !profileError) {
          console.log('AuthProvider: User profile created/retrieved successfully:', profileData);
          clearTimeout(timeoutId);

          // If profile was just created, fetch the full profile data
          if (profileData.exists === true) {
            // Profile already existed, fetch it
            const { data: userProfile, error: fetchError } = await supabase!
              .from('users')
              .select('id, name, email, role, org_id, organization')
              .eq('id', userId)
              .maybeSingle();

            if (userProfile && !fetchError && !profileLoadCompleted) {
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
              setLoading(false);
              setIsInitialized(true);
              profileLoadCompleted = true;
              console.log('AuthProvider: User profile loaded successfully:', appUser.name);
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
            setLoading(false);
            setIsInitialized(true);
            profileLoadCompleted = true;
            console.log('AuthProvider: User profile created successfully:', appUser.name);
            return;
          }
        }
      } catch (rpcError) {
        console.log('AuthProvider: RPC call failed:', rpcError);
      }

      if (profileLoadCompleted) return;
      
      console.log('AuthProvider: RPC call failed or returned no data, trying fallbacks');

      // Clear timeout and try fallback
      clearTimeout(timeoutId);

      // Fallback: Try to load existing profile directly
      console.log('AuthProvider: Trying direct profile fetch as fallback');
      try {
        const { data: userProfile, error: fetchError } = await supabase!
          .from('users')
          .select('id, name, email, role, org_id, organization')
          .eq('id', userId)
          .maybeSingle();

        if (profileLoadCompleted) return;

        if (userProfile && !fetchError) {
          console.log('AuthProvider: Found existing user profile via fallback, setting user data...');
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
          setLoading(false);
          setIsInitialized(true);
          profileLoadCompleted = true;
          console.log('AuthProvider: User profile loaded via fallback:', appUser.name);
          return;
        }
      } catch (fallbackError) {
        console.log('AuthProvider: Direct profile fetch failed:', fallbackError);
      }

      if (profileLoadCompleted) return;

      console.log('AuthProvider: Profile not found via fallback, creating minimal profile');

      // Create minimal profile if user doesn't exist in users table
      try {
        const { data: session } = await supabase!.auth.getSession();
        const userEmail = session?.session?.user?.email;
        const userName = session?.session?.user?.user_metadata?.name || userEmail?.split('@')[0] || 'Unknown User';

        const { data: newProfile, error: insertError } = await supabase!
          .from('users')
          .insert({
            id: userId,
            name: userName,
            email: userEmail || '',
            role: 'client-manager', // Default role
            organization: 'Unknown Organization'
          })
          .select('id, name, email, role, org_id, organization')
          .single();

        if (newProfile && !insertError && !profileLoadCompleted) {
          const appUser: User = {
            id: newProfile.id,
            name: newProfile.name,
            email: newProfile.email || '',
            role: newProfile.role,
            organization: newProfile.organization || 'Unknown Organization',
            orgCode: newProfile.role === 'admin' ? 'ADMIN' : 'UNKNOWN',
            org_id: newProfile.org_id || undefined
          };
          setUser(appUser);
          setLoading(false);
          setIsInitialized(true);
          profileLoadCompleted = true;
          console.log('AuthProvider: Minimal user profile created successfully:', appUser.name);
          return;
        }
      } catch (insertError) {
        console.error('AuthProvider: Error creating minimal profile:', insertError);
      }

      if (profileLoadCompleted) return;

      // Final fallback - create basic user object from auth session
      console.log('AuthProvider: Using auth session data as final fallback');
      try {
        const { data: session } = await supabase!.auth.getSession();
        if (session?.session?.user && !profileLoadCompleted) {
          const authUser = session.session.user;
          const appUser: User = {
            id: authUser.id,
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Unknown User',
            email: authUser.email || '',
            role: 'client-manager', // Default role
            organization: 'Unknown Organization',
            orgCode: 'UNKNOWN'
          };
          setUser(appUser);
          setLoading(false);
          setIsInitialized(true);
          profileLoadCompleted = true;
          console.log('AuthProvider: Using auth session as final fallback:', appUser.name);
          return;
        }
      } catch (sessionError) {
        console.error('AuthProvider: Error getting session for fallback:', sessionError);
      }

      // If all else fails, set user to null but complete initialization
      if (!profileLoadCompleted) {
        console.log('AuthProvider: All profile loading attempts failed, setting user to null');
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
        profileLoadCompleted = true;
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
      let sessionCheckCompleted = false;
      
      try {
        // Add timeout to session check to prevent hanging
        const timeoutId = setTimeout(() => {
          if (!sessionCheckCompleted) {
            console.warn('AuthProvider: Session check timeout, proceeding with no session');
            setUser(null);
            setLoading(false);
            setIsInitialized(true);
            sessionCheckCompleted = true;
          }
        }, 2000); // Reduced to 2 seconds for faster fallback

        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('AuthProvider: Session check result:', session?.user?.id || 'no session', error);

        if (!sessionCheckCompleted) {
          clearTimeout(timeoutId);
          sessionCheckCompleted = true;

          if (error) {
            console.error('AuthProvider: Error checking session:', error);
            setLoading(false);
            setIsInitialized(true);
            return;
          }

          if (session?.user) {
            // Use the new loadUserProfile function which will create profile if needed
            await loadUserProfile(session.user.id);
          } else {
            // Explicitly handle no session case
            console.log('AuthProvider: No session found during check, setting up for login');
            setUser(null);
            setLoading(false);
            setIsInitialized(true);
          }
        }
      } catch (error) {
        console.error('AuthProvider: Error checking user session:', error);
        if (!sessionCheckCompleted) {
          setUser(null);
          setLoading(false); // Always set loading to false to prevent hanging
          setIsInitialized(true);
          sessionCheckCompleted = true;
        }
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