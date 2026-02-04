/**
 * Auth utility functions for handling session cleanup and recovery
 */

const SUPABASE_AUTH_KEY = 'sb-zuwnpyvzrvrhwnryaqhd-auth-token';

/**
 * Clears all Supabase auth data from localStorage.
 * Use this when auth is in a corrupted state (e.g., stale refresh tokens).
 */
export function clearAuthStorage(): void {
  try {
    // Remove the main auth token
    localStorage.removeItem(SUPABASE_AUTH_KEY);
    
    // Also clear any other potential Supabase keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('[AuthUtils] Cleared corrupted auth storage');
  } catch (error) {
    console.error('[AuthUtils] Failed to clear auth storage:', error);
  }
}

/**
 * Checks if the current auth token appears corrupted or stale.
 * Returns true if the token should be cleared.
 */
export function isAuthTokenCorrupted(): boolean {
  try {
    const tokenStr = localStorage.getItem(SUPABASE_AUTH_KEY);
    if (!tokenStr) return false;
    
    const token = JSON.parse(tokenStr);
    
    // Check if token has expired (with 5 minute buffer)
    if (token.expires_at) {
      const expiresAt = token.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const bufferMs = 5 * 60 * 1000; // 5 minutes
      
      if (expiresAt < now - bufferMs) {
        console.log('[AuthUtils] Token appears expired');
        return true;
      }
    }
    
    // Check if required fields are missing
    if (!token.access_token || !token.refresh_token) {
      console.log('[AuthUtils] Token missing required fields');
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('[AuthUtils] Token parse error - likely corrupted');
    return true;
  }
}

/**
 * Handle auth errors by clearing storage if necessary and returning
 * whether the error was a token-related error that was handled.
 */
export function handleAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  
  const errorObj = error as { code?: string; message?: string };
  
  const isTokenError = 
    errorObj.code === 'refresh_token_not_found' ||
    errorObj.code === 'bad_jwt' ||
    errorObj.message?.includes('Refresh Token') ||
    errorObj.message?.includes('invalid claim') ||
    errorObj.message?.includes('missing sub claim');
  
  if (isTokenError) {
    console.log('[AuthUtils] Detected token error, clearing storage');
    clearAuthStorage();
    return true;
  }
  
  return false;
}
