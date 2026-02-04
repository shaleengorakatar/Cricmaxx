/**
 * Public API utilities for fetching data without auth dependencies.
 * Uses direct REST API calls with only the anon key to bypass JWT issues.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface PublicApiOptions {
  table: string;
  select?: string;
  filters?: Record<string, string>;
  order?: string;
  limit?: number;
}

/**
 * Fetch data from Supabase using direct REST API (no auth token).
 * This ensures public data (like markets) always loads regardless of JWT state.
 */
export async function fetchPublicData<T = any>(options: PublicApiOptions): Promise<T[]> {
  const { table, select = '*', filters = {}, order, limit } = options;
  
  const params = new URLSearchParams({ select });
  
  // Add filters
  Object.entries(filters).forEach(([key, value]) => {
    params.append(key, value);
  });
  
  // Add order
  if (order) {
    params.append('order', order);
  }
  
  // Add limit
  if (limit) {
    params.append('limit', String(limit));
  }
  
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      // No Authorization header - uses RLS anon policies
    }
  });
  
  if (!response.ok) {
    throw new Error(`Public API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}
