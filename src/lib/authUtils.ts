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
    
    // Safari sometimes returns "undefined" as a string
    if (tokenStr === 'undefined' || tokenStr === 'null' || tokenStr.trim() === '') {
      console.log('[AuthUtils] Token is empty or undefined string');
      return true;
    }
    
    const token = JSON.parse(tokenStr);
    
    // Check if token object is valid
    if (!token || typeof token !== 'object') {
      console.log('[AuthUtils] Token is not a valid object');
      return true;
    }
    
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
    
    // Validate JWT structure (Safari-specific: sometimes JWTs get truncated)
    const accessToken = token.access_token;
    if (typeof accessToken === 'string') {
      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        console.log('[AuthUtils] Access token has invalid JWT structure');
        return true;
      }
      
      // Try to decode the payload to check for 'sub' claim
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (!payload.sub) {
          console.log('[AuthUtils] JWT missing sub claim');
          return true;
        }
      } catch {
        console.log('[AuthUtils] JWT payload decode failed');
        return true;
      }
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
  
  const errorObj = error as { code?: string; message?: string; status?: number };
  
  const isTokenError = 
    errorObj.code === 'refresh_token_not_found' ||
    errorObj.code === 'bad_jwt' ||
    errorObj.code === 'invalid_grant' ||
    errorObj.code === 'session_not_found' ||
    errorObj.status === 403 ||
    errorObj.status === 401 ||
    errorObj.message?.includes('Refresh Token') ||
    errorObj.message?.includes('invalid claim') ||
    errorObj.message?.includes('missing sub claim') ||
    errorObj.message?.includes('JWT') ||
    errorObj.message?.includes('session');
  
  if (isTokenError) {
    console.log('[AuthUtils] Detected token error, clearing storage:', errorObj.message || errorObj.code);
    clearAuthStorage();
    return true;
  }
  
  return false;
}

/**
 * Check if we're running in Safari (for browser-specific workarounds)
 */
export function isSafari(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');
}
