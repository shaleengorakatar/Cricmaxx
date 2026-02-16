import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { clearAuthStorage, handleAuthError, isAuthTokenCorrupted } from "@/lib/authUtils";

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

  // Refs to track current state for use in callbacks
  const userRef = useRef<User | null>(null);
  const isRefreshingRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  const isSigningOutRef = useRef(false);
  const initCompleteRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Clear all auth state
  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setProfileError(false);
    setProfileLoading(false);
    userRef.current = null;
  }, []);

  // Fetch user profile and roles
  const fetchUserData = useCallback(async (userId: string): Promise<'success' | 'permission_denied' | 'error'> => {
    try {
      setProfileLoading(true);
      
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        
        const isPermissionError = fetchError.message?.includes('permission denied') || 
                                  fetchError.code === '42501' ||
                                  fetchError.code === 'PGRST301';
        
        setProfileError(true);
        setProfileLoading(false);
        
        return isPermissionError ? 'permission_denied' : 'error';
      }
      
      // Normalize nullable numeric fields to prevent .toFixed/.toLocaleString crashes
      setProfile({
        ...profileData,
        balance: Number(profileData.balance) || 0,
        rating_score: Number(profileData.rating_score) || 0,
        predictions_total: Number(profileData.predictions_total) || 0,
        predictions_correct: Number(profileData.predictions_correct) || 0,
      });
      setProfileError(false);
      setProfileLoading(false);

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!rolesError && rolesData) {
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

    const initializeAuth = async () => {
      try {
        // Check for corrupted tokens BEFORE trying to get session
        if (isAuthTokenCorrupted()) {
          console.log('[AuthContext] Detected corrupted token on init, clearing');
          clearAuthStorage();
          if (isMounted) {
            clearAuthState();
            setLoading(false);
            initCompleteRef.current = true;
          }
          return;
        }

        // Get existing session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        // Handle session errors
        if (sessionError) {
          console.warn('[AuthContext] Session error:', sessionError.message);
          if (handleAuthError(sessionError)) {
            if (isMounted) {
              clearAuthState();
              setLoading(false);
              initCompleteRef.current = true;
            }
            return;
          }
        }
        
        // No session - try refresh (Safari ITP workaround)
        if (!initialSession) {
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              // This is expected for logged-out users, don't treat as error
              if (handleAuthError(refreshError)) {
                console.log('[AuthContext] Cleared stale refresh token');
              }
            } else if (refreshData.session && isMounted) {
              setSession(refreshData.session);
              setUser(refreshData.session.user);
              await fetchUserData(refreshData.session.user.id);
              setLoading(false);
              initCompleteRef.current = true;
              return;
            }
          } catch (refreshErr) {
            // Refresh failed - user is logged out, this is fine
            console.log('[AuthContext] Refresh failed, user is logged out');
            handleAuthError(refreshErr);
          }
        }
        
        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          const result = await fetchUserData(initialSession.user.id);
          if (result === 'permission_denied' && isMounted) {
            console.warn('[AuthContext] Profile fetch permission denied - clearing session');
            clearAuthStorage();
            await supabase.auth.signOut();
            clearAuthState();
          }
        }
      } catch (error) {
        console.error('[AuthContext] Init error:', error);
        handleAuthError(error);
        if (isMounted) {
          clearAuthState();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          initCompleteRef.current = true;
        }
      }
    };

    initializeAuth();

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!initCompleteRef.current) return;
        if (!isMounted) return;
        
        // Handle SIGNED_OUT event
        if (event === 'SIGNED_OUT') {
          clearAuthState();
          return;
        }
        
        // Handle TOKEN_REFRESHED errors
        if (event === 'TOKEN_REFRESHED' && !currentSession) {
          console.log('[AuthContext] Token refresh failed');
          clearAuthStorage();
          clearAuthState();
          return;
        }
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            if (!isMounted) return;
            const result = await fetchUserData(currentSession.user.id);
            if (result === 'permission_denied' && isMounted) {
              clearAuthStorage();
              await supabase.auth.signOut();
              clearAuthState();
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    // Visibility change handler
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        
        if (timeSinceActivity > 2 * 60 * 1000 && userRef.current && !isRefreshingRef.current && !isSigningOutRef.current) {
          isRefreshingRef.current = true;
          
          try {
            const { data, error } = await supabase.auth.refreshSession();
            
            if (error) {
              console.warn('[AuthContext] Visibility refresh failed:', error.message);
              if (handleAuthError(error)) {
                clearAuthState();
              }
            } else if (data.session && isMounted) {
              await fetchUserData(data.session.user.id);
            }
          } catch (err) {
            console.error('[AuthContext] Visibility refresh error:', err);
            handleAuthError(err);
          } finally {
            isRefreshingRef.current = false;
          }
        }
        
        lastActivityRef.current = Date.now();
      } else {
        lastActivityRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, fetchUserData, clearAuthState]);

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
    // Only clear state (not storage) — signInWithPassword will replace the token
    clearAuthState();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { data, error };
  };

  const signOut = async () => {
    isSigningOutRef.current = true;
    userRef.current = null;
    
    // Clear state first
    clearAuthState();
    
    // Clear storage
    clearAuthStorage();
    
    // Then sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    isSigningOutRef.current = false;
    
    if (!error) {
      navigate('/');
    }
    return { error };
  };

  const hasRole = (role: string) => roles.includes(role);

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
        setProfile({
          ...profileData,
          balance: Number(profileData.balance) || 0,
          rating_score: Number(profileData.rating_score) || 0,
          predictions_total: Number(profileData.predictions_total) || 0,
          predictions_correct: Number(profileData.predictions_correct) || 0,
        });
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
