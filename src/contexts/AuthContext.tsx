import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  kyc_verified: boolean;
  mfa_enabled: boolean;
  balance: number;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  rating_score: number;
  predictions_total: number;
  predictions_correct: number;
  show_on_leaderboard: boolean;
}

export interface UserRole {
  role: 'admin' | 'creator' | 'trader';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: string[];
  loading: boolean;
  profileError: boolean;
  profileLoading: boolean;
  refetchProfile: () => Promise<void>;
  signUp: (email: string, password: string, name: string, accountType: 'trader' | 'creator') => Promise<{ data: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
  hasRole: (role: string) => boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  isTrader: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const navigate = useNavigate();

  // Refs to track current state for use in callbacks (prevents stale closures)
  const userRef = useRef<User | null>(null);
  const isRefreshingRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Keep refs in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Fetch user profile and roles
  const fetchUserData = useCallback(async (userId: string, isPostAuthFetch = false): Promise<'success' | 'permission_denied' | 'error'> => {
    try {
      if (isPostAuthFetch) {
        setProfileLoading(true);
      }
      
      // Fetch profile
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        
        // Check if this is a permission/RLS error (indicates bad JWT)
        const isPermissionError = fetchError.message?.includes('permission denied') || 
                                  fetchError.code === '42501' ||
                                  fetchError.code === 'PGRST301';
        
        setProfileError(true);
        setProfileLoading(false);
        
        return isPermissionError ? 'permission_denied' : 'error';
      }
      
      setProfile(profileData);
      setProfileError(false);
      setProfileLoading(false);

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        // Don't fail completely for roles error, profile is more important
      } else {
        setRoles(rolesData.map((r: UserRole) => r.role));
      }
      
      return 'success';
    } catch (error) {
      console.error('Error fetching user data:', error);
      setProfileError(true);
      setProfileLoading(false);
      return 'error';
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let isInitialized = false; // Track if initial load is complete

    // INITIAL load (controls loading state) - must complete before onAuthStateChange matters
    const initializeAuth = async () => {
      try {
        // Get existing session - this is synchronous from localStorage
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        // Only try refresh if no session found (Safari ITP workaround)
        if (!initialSession) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session) {
            if (isMounted) {
              setSession(refreshData.session);
              setUser(refreshData.session.user);
              await fetchUserData(refreshData.session.user.id);
            }
            return;
          }
        }
        
        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Fetch profile data BEFORE setting loading false
        if (initialSession?.user) {
          const result = await fetchUserData(initialSession.user.id);
          if (result === 'permission_denied' && isMounted) {
            console.warn('Profile fetch permission denied - signing out');
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isMounted) setProfileError(true);
      } finally {
        if (isMounted) {
          setLoading(false);
          isInitialized = true;
        }
      }
    };

    // Start initialization immediately
    initializeAuth();

    // Listener for ONGOING auth changes (only matters AFTER initial load)
    // Supabase's autoRefreshToken handles token refresh automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        // Skip if still in initial loading - initializeAuth handles this
        if (!isInitialized) return;
        if (!isMounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          setProfileLoading(true);
          
          const timeoutId = setTimeout(() => {
            if (isMounted) {
              setProfileError(true);
              setProfileLoading(false);
            }
          }, 10000);
          
          const result = await fetchUserData(currentSession.user.id, true);
          clearTimeout(timeoutId);
          
          if (result === 'permission_denied' && isMounted) {
            await supabase.auth.signOut();
          }
        } else {
          setProfile(null);
          setRoles([]);
          setProfileError(false);
          setProfileLoading(false);
        }
      }
    );

    // Visibility change handler - refresh session when returning to tab after extended absence
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        
        // If away for more than 2 minutes and we have a user, proactively refresh
        if (timeSinceActivity > 2 * 60 * 1000 && userRef.current && !isRefreshingRef.current) {
          isRefreshingRef.current = true;
          
          try {
            const { data, error } = await supabase.auth.refreshSession();
            
            if (error) {
              console.warn('Session refresh failed on visibility change:', error.message);
              // If refresh fails, sign out to force re-login
              if (error.message?.includes('invalid') || error.message?.includes('expired')) {
                await supabase.auth.signOut();
              }
            } else if (data.session && isMounted) {
              // Session refreshed successfully - refetch profile data
              await fetchUserData(data.session.user.id);
            }
          } catch (err) {
            console.error('Error during visibility refresh:', err);
          } finally {
            isRefreshingRef.current = false;
          }
        }
        
        lastActivityRef.current = Date.now();
      } else {
        // Tab hidden - record time
        lastActivityRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, fetchUserData]);

  const signUp = async (email: string, password: string, name: string, accountType: 'trader' | 'creator') => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
          account_type: accountType
        }
      }
    });
    
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { data, error };
  };

  const signOut = async () => {
    // Clear local state first
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    
    // Then call Supabase signOut
    const { error } = await supabase.auth.signOut();
    
    // Navigate after sign out completes
    if (!error) {
      navigate('/');
    }
    return { error };
  };

  const hasRole = (role: string) => {
    return roles.includes(role);
  };

  // Retry profile fetch function for recovery
  const refetchProfile = useCallback(async () => {
    if (userRef.current?.id) {
      setProfileError(false);
      setProfileLoading(true);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userRef.current.id)
        .single();

      setProfileLoading(false);
      if (!error && profileData) {
        setProfile(profileData);
      } else {
        setProfileError(true);
      }
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    profile,
    roles,
    loading,
    profileError,
    profileLoading,
    refetchProfile,
    signUp,
    signIn,
    signOut,
    hasRole,
    isAuthenticated: !!user,
    isAdmin: roles.includes('admin'),
    isCreator: roles.includes('creator'),
    isTrader: roles.includes('trader')
  };

  return (
    <AuthContext.Provider value={value}>
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
