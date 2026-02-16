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
    
    // Only check for structurally corrupt tokens — NOT expired ones.
    // Expired access tokens are normal; Supabase's refreshSession() will
    // use the refresh_token to obtain a new access token. Deleting the
    // refresh token here would log the user out unnecessarily (especially
    // on Safari iOS where users close & reopen tabs frequently).
    
    // Check if the access_token is structurally valid (3-part JWT)
    if (token.access_token && typeof token.access_token === 'string') {
      const parts = token.access_token.split('.');
      if (parts.length !== 3) {
        console.log('[AuthUtils] Access token is not a valid JWT structure');
        return true;
      }
      // Check for 'sub' claim in payload
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (!payload.sub) {
          console.log('[AuthUtils] Token missing sub claim');
          return true;
        }
      } catch {
        console.log('[AuthUtils] Token payload not decodable');
        return true;
      }
    }
    
    // Missing refresh token means we can't recover — that's truly corrupt
    if (!token.refresh_token) {
      console.log('[AuthUtils] Token missing refresh_token');
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
