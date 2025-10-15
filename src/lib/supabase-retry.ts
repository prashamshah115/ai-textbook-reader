// ================================================================
// SIMPLE SUPABASE RETRY - FIXES 406 ERRORS
// ================================================================
// This is a minimal wrapper that adds retry logic to the most common
// Supabase operations without changing the API.

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create the base client
const baseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper to check if error is auth-related
function isAuthError(error: any): boolean {
  return error?.code === '406' || 
         error?.code === 'PGRST301' || 
         error?.message?.includes('JWT') ||
         error?.message?.includes('session') ||
         error?.message?.includes('token');
}

// Simple retry wrapper
async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName = 'operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (isAuthError(error)) {
      console.log(`[SupabaseRetry] ${operationName} failed with auth error, refreshing session and retrying...`);
      
      // Refresh the session
      const { error: refreshError } = await baseClient.auth.refreshSession();
      if (refreshError) {
        console.error('[SupabaseRetry] Session refresh failed:', refreshError);
        throw error; // Throw original error if refresh fails
      }
      
      // Wait a moment for the new token to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Retry once with fresh token
      try {
        return await operation();
      } catch (retryError) {
        console.error(`[SupabaseRetry] ${operationName} failed even after retry:`, retryError);
        throw retryError;
      }
    }
    
    // If it's not an auth error, throw immediately
    throw error;
  }
}

// Override the most commonly used methods with retry logic
const originalFrom = baseClient.from.bind(baseClient);

baseClient.from = function(table: string) {
  const tableClient = originalFrom(table);
  
  // Override the most common query methods
  const originalSelect = tableClient.select.bind(tableClient);
  const originalInsert = tableClient.insert.bind(tableClient);
  const originalUpdate = tableClient.update.bind(tableClient);
  const originalDelete = tableClient.delete.bind(tableClient);
  
  tableClient.select = function(columns?: string) {
    const query = originalSelect(columns);
    
    // Override the final execution methods
    const originalSingle = query.single.bind(query);
    const originalMaybeSingle = query.maybeSingle.bind(query);
    
    query.single = function() {
      return retryOperation(
        () => originalSingle(),
        `select.single from ${table}`
      );
    };
    
    query.maybeSingle = function() {
      return retryOperation(
        () => originalMaybeSingle(),
        `select.maybeSingle from ${table}`
      );
    };
    
    return query;
  };
  
  tableClient.insert = function(values: any) {
    const query = originalInsert(values);
    
    const originalThen = query.then.bind(query);
    query.then = function(onResolve: any, onReject?: any) {
      return retryOperation(
        () => originalThen(onResolve, onReject),
        `insert into ${table}`
      );
    };
    
    return query;
  };
  
  tableClient.update = function(values: any) {
    const query = originalUpdate(values);
    
    // Override eq method
    const originalEq = query.eq.bind(query);
    query.eq = function(column: string, value: any) {
      const eqQuery = originalEq(column, value);
      
      const originalThen = eqQuery.then.bind(eqQuery);
      eqQuery.then = function(onResolve: any, onReject?: any) {
        return retryOperation(
          () => originalThen(onResolve, onReject),
          `update ${table}`
        );
      };
      
      return eqQuery;
    };
    
    return query;
  };
  
  tableClient.delete = function() {
    const query = originalDelete();
    
    // Override eq method
    const originalEq = query.eq.bind(query);
    query.eq = function(column: string, value: any) {
      const eqQuery = originalEq(column, value);
      
      const originalThen = eqQuery.then.bind(eqQuery);
      eqQuery.then = function(onResolve: any, onReject?: any) {
        return retryOperation(
          () => originalThen(onResolve, onReject),
          `delete from ${table}`
        );
      };
      
      return eqQuery;
    };
    
    return query;
  };
  
  return tableClient;
};

// Also override storage operations
const originalStorageFrom = baseClient.storage.from.bind(baseClient.storage);

baseClient.storage.from = function(bucket: string) {
  const bucketClient = originalStorageFrom(bucket);
  
  const originalUpload = bucketClient.upload.bind(bucketClient);
  bucketClient.upload = function(path: string, file: File, options?: any) {
    return retryOperation(
      () => originalUpload(path, file, options),
      `storage upload to ${bucket}`
    );
  };
  
  return bucketClient;
};

// Export the enhanced client
export const supabase = baseClient;

// Helper to check if user is whitelisted
export async function isUserWhitelisted(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      console.error('[Whitelist Check]', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('[Whitelist Check] Exception:', error);
    return false;
  }
}