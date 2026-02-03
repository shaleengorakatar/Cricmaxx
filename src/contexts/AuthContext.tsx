import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();
  
  // Use ref for lastActiveTime to persist across re-renders
  const lastActiveTimeRef = useRef<number>(Date.now());
  // Ref to prevent concurrent refresh calls (debouncing)
  const isRefreshingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    let isInitialized = false; // Track if initial load is complete
    let proactiveRefreshInterval: NodeJS.Timeout | null = null;
    const STALE_SESSION_THRESHOLD = 15 * 60 * 1000; // 15 minutes - refresh session if away longer than this
    const PROACTIVE_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes - proactively refresh token

    // Core session refresh logic - used by both visibility change and proactive refresh
    const performSessionRefresh = async (reason: 'visibility' | 'proactive'): Promise<boolean> => {
      // Prevent concurrent refresh calls (debouncing)
      if (isRefreshingRef.current) {
        return false;
      }
      
      isRefreshingRef.current = true;
      
      try {
        // First check current session state without network call
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        // If no session exists, user is already logged out - don't try to refresh
        if (!currentSession) {
          return false;
        }
        
        // Check if the session token looks valid before attempting refresh
        if (!currentSession.access_token || !currentSession.refresh_token) {
          console.warn('Invalid session tokens found, clearing session');
          await supabase.auth.signOut();
          return false;
        }
        
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        // Check if it's a true auth error vs network error
        const isAuthError = refreshError && (
          refreshError.message?.includes('invalid') ||
          refreshError.message?.includes('expired') ||
          refreshError.message?.includes('JWT') ||
          refreshError.message?.includes('missing sub claim') ||
          refreshError.status === 401 ||
          refreshError.status === 403
        );
        
        if (isAuthError && !refreshData?.session) {
          // Session truly expired - notify user and redirect
          if (isMounted) {
            // Let onAuthStateChange handle state clearing
            await supabase.auth.signOut();
            
            // Only show toast and navigate if not already on home page
            if (location.pathname !== '/') {
              toast.info("Session expired", {
                description: "You've been logged out due to inactivity. Please sign in again.",
                duration: 5000,
              });
              
              navigate('/');
            }
          }
          return false;
        }
        
        // Session refreshed successfully
        return !!refreshData?.session;
      } catch (err) {
        console.error(`Error during ${reason} session refresh:`, err);
        // Don't clear state on network/unexpected errors - let normal requests handle it
        return false;
      } finally {
        isRefreshingRef.current = false;
        lastActiveTimeRef.current = Date.now();
      }
    };

    // Session refresh on tab visibility change - only if user was away for a while
    const refreshSessionOnVisibility = async () => {
      if (document.visibilityState !== 'visible') {
        // Track when user left
        lastActiveTimeRef.current = Date.now();
        return;
      }
      
      // Don't run during initial auth load - wait for initialization
      if (!isInitialized) {
        return;
      }
      
      // Only refresh if user was away for more than threshold
      const timeSinceActive = Date.now() - lastActiveTimeRef.current;
      if (timeSinceActive < STALE_SESSION_THRESHOLD) {
        // Not away long enough - no need to refresh, just update active time
        lastActiveTimeRef.current = Date.now();
        return;
      }
      
      await performSessionRefresh('visibility');
    };

    // Proactive session refresh - runs every 10 minutes to keep token fresh
    const startProactiveRefresh = () => {
      proactiveRefreshInterval = setInterval(async () => {
        if (!isInitialized || document.visibilityState !== 'visible') {
          return;
        }
        
        // Check if we have a session before trying to refresh
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          await performSessionRefresh('proactive');
        }
      }, PROACTIVE_REFRESH_INTERVAL);
    };

    // Fetch user profile and roles - defined inside to access isMounted
    const fetchUserData = async (userId: string, isPostAuthFetch = false): Promise<'success' | 'permission_denied' | 'error'> => {
      try {
        if (isPostAuthFetch && isMounted) {
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
          
          if (isMounted) {
            setProfileError(true);
            setProfileLoading(false);
          }
          
          return isPermissionError ? 'permission_denied' : 'error';
        }
        
        if (isMounted) {
          setProfile(profileData);
          setProfileError(false);
          setProfileLoading(false);
        }

        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
          // Don't fail completely for roles error, profile is more important
        } else if (isMounted) {
          setRoles(rolesData.map((r: UserRole) => r.role));
        }
        
        return 'success';
      } catch (error) {
        console.error('Error fetching user data:', error);
        if (isMounted) {
          setProfileError(true);
          setProfileLoading(false);
        }
        return 'error';
      }
    };

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
    initializeAuth().then(() => {
      // Start proactive refresh after auth is initialized
      startProactiveRefresh();
    });

    // Listener for ONGOING auth changes (only matters AFTER initial load)
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

    // Add visibility change listener to refresh session when tab becomes active
    document.addEventListener('visibilitychange', refreshSessionOnVisibility);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', refreshSessionOnVisibility);
      if (proactiveRefreshInterval) {
        clearInterval(proactiveRefreshInterval);
      }
    };
  }, [navigate, location.pathname]);

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
  const refetchProfile = async () => {
    if (user?.id) {
      setProfileError(false);
      setProfileLoading(true);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfileLoading(false);
      if (!error && profileData) {
        setProfile(profileData);
      } else {
        setProfileError(true);
      }
    }
  };

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
