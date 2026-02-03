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
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    // Fetch user profile and roles - defined inside to access isMounted
    const fetchUserData = async (userId: string): Promise<boolean> => {
      try {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          return false;
        }
        
        if (isMounted) {
          setProfile(profileData);
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
        return false;
      }
    };

    // Listener for ONGOING auth changes (does NOT control loading state)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Fire and forget - don't await, don't set loading
        // This handles sign-in/sign-out events AFTER initial load
        if (currentSession?.user) {
          fetchUserData(currentSession.user.id);
        } else {
          setProfile(null);
          setRoles([]);
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

  return {
    user,
    session,
    profile,
    roles,
    loading,
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
