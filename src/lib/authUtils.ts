/**
 * Auth utility functions for handling session cleanup and recovery
 * Enhanced for Safari/Mac compatibility
 */

const SUPABASE_AUTH_KEY = 'sb-zuwnpyvzrvrhwnryaqhd-auth-token';

/**
 * Check if we're running in Safari (for browser-specific workarounds)
 */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');
}

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
    
    // Safari-specific: also clear sessionStorage
    if (isSafari()) {
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
    
    console.log('[AuthUtils] Cleared corrupted auth storage');
  } catch (error) {
    console.error('[AuthUtils] Failed to clear auth storage:', error);
  }
}

/**
 * Validates a JWT token structure and checks for required claims
 */
function validateJwtStructure(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  try {
    // Decode payload and check for sub claim
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.sub) return false;
    
    // Check if token is expired (with 30 second buffer)
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now - 30) return false;
    }
    
    return true;
  } catch {
    return false;
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
    
    let token;
    try {
      token = JSON.parse(tokenStr);
    } catch {
      console.log('[AuthUtils] Token JSON parse failed');
      return true;
    }
    
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
    
    // Validate access token JWT structure (critical for Safari)
    if (!validateJwtStructure(token.access_token)) {
      console.log('[AuthUtils] Access token has invalid JWT structure or missing sub claim');
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('[AuthUtils] Token validation error - likely corrupted');
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
    errorObj.code === 'user_not_found' ||
    errorObj.status === 403 ||
    errorObj.status === 401 ||
    errorObj.message?.includes('Refresh Token') ||
    errorObj.message?.includes('invalid claim') ||
    errorObj.message?.includes('missing sub claim') ||
    errorObj.message?.includes('JWT') ||
    errorObj.message?.includes('session') ||
    errorObj.message?.includes('expired');
  
  if (isTokenError) {
    console.log('[AuthUtils] Detected token error, clearing storage:', errorObj.message || errorObj.code);
    clearAuthStorage();
    return true;
  }
  
  return false;
}

/**
 * Force a clean auth state - use when Safari has corrupted storage
 */
export function forceCleanAuthState(): void {
  clearAuthStorage();
  
  // Clear any in-memory state that might be stale
  if (isSafari()) {
    console.log('[AuthUtils] Safari detected - performing deep clean');
  }
}
