import { useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    // Fetch user profile and roles - defined inside to access isMounted
    const fetchUserData = async (userId: string, isPostAuthFetch = false): Promise<boolean> => {
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
          if (isMounted) {
            setProfileError(true);
            setProfileLoading(false);
          }
          return false;
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
          return false;
        }
        
        if (isMounted) {
          setRoles(rolesData.map((r: UserRole) => r.role));
        }
        
        return true;
      } catch (error) {
        console.error('Error fetching user data:', error);
        if (isMounted) {
          setProfileError(true);
          setProfileLoading(false);
        }
        return false;
      }
    };

    // Listener for ONGOING auth changes (does NOT control loading state)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Handle sign-in/sign-out events AFTER initial load
        if (currentSession?.user) {
          // Set a flag that we're fetching, timeout will check this
          let fetchCompleted = false;
          
          // Use a timeout to ensure we show error state if profile fetch takes too long
          const timeoutId = setTimeout(() => {
            if (isMounted && !fetchCompleted) {
              console.warn('Profile fetch timeout - showing error state');
              setProfileError(true);
              setProfileLoading(false);
            }
          }, 10000); // 10 second timeout for mobile
          
          await fetchUserData(currentSession.user.id, true);
          fetchCompleted = true;
          clearTimeout(timeoutId);
        } else {
          setProfile(null);
          setRoles([]);
          setProfileError(false);
          setProfileLoading(false);
        }
      }
    );

    // INITIAL load (controls loading state)
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Fetch data BEFORE setting loading false
        if (initialSession?.user) {
          await fetchUserData(initialSession.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isMounted) setProfileError(true);
      } finally {
        // Only set loading false after ALL initial operations complete
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
    const { error } = await supabase.auth.signOut();
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

  return {
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
};
