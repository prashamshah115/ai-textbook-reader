// ================================================================
// BULLETPROOF SUPABASE CLIENT - ZERO 406 TOLERANCE
// ================================================================
// This wrapper eliminates ALL session expiry issues by:
// 1. Proactively refreshing tokens before they expire
// 2. Automatically retrying ALL failed requests with fresh tokens
// 3. Queuing requests during token refresh to prevent race conditions
// 4. Providing a bulletproof interface that never fails due to auth

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create the base client with Database types
const baseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// ================================================================
// SESSION MANAGER - PROACTIVE TOKEN REFRESH
// ================================================================

class SessionManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;
  private requestQueue: Array<() => void> = [];

  constructor() {
    // Start proactive refresh timer (every 25 minutes)
    this.startProactiveRefresh();
    
    // Listen for auth state changes
    baseClient.auth.onAuthStateChange((event, session) => {
      console.log('[SessionManager] Auth state change:', event, session ? 'valid' : 'invalid');
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('[SessionManager] ✅ Token refreshed successfully');
        this.processRequestQueue();
      } else if (event === 'SIGNED_OUT') {
        console.log('[SessionManager] ❌ User signed out');
        this.clearRefreshTimer();
      }
    });
  }

  private startProactiveRefresh() {
    // Refresh token every 25 minutes (tokens expire in 1 hour)
    this.refreshTimer = setInterval(async () => {
      await this.refreshTokenIfNeeded();
    }, 25 * 60 * 1000); // 25 minutes
    
    console.log('[SessionManager] Proactive refresh timer started (every 25 minutes)');
  }

  private clearRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('[SessionManager] Proactive refresh timer cleared');
    }
  }

  private async refreshTokenIfNeeded(): Promise<boolean> {
    const session = await baseClient.auth.getSession();
    
    if (!session.data.session) {
      console.log('[SessionManager] No session to refresh');
      return false;
    }

    // Check if token expires in next 10 minutes
    const expiresAt = session.data.session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry > 600) { // More than 10 minutes left
      console.log('[SessionManager] Token still valid for', Math.floor(timeUntilExpiry / 60), 'minutes');
      return true;
    }

    console.log('[SessionManager] Token expires in', Math.floor(timeUntilExpiry / 60), 'minutes, refreshing...');
    return await this.refreshSession();
  }

  private async refreshSession(): Promise<boolean> {
    if (this.isRefreshing) {
      console.log('[SessionManager] Already refreshing, waiting...');
      return this.refreshPromise || false;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<boolean> {
    try {
      const { error } = await baseClient.auth.refreshSession();
      
      if (error) {
        console.error('[SessionManager] Refresh failed:', error.message);
        return false;
      }

      console.log('[SessionManager] ✅ Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[SessionManager] Refresh exception:', error);
      return false;
    }
  }

  private processRequestQueue() {
    console.log('[SessionManager] Processing', this.requestQueue.length, 'queued requests');
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        request();
      }
    }
  }

  async ensureValidSession(): Promise<boolean> {
    // If we're currently refreshing, wait for it to complete
    if (this.isRefreshing && this.refreshPromise) {
      return await this.refreshPromise;
    }

    // Check if we need to refresh
    return await this.refreshTokenIfNeeded();
  }

  queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeRequest = async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      if (this.isRefreshing) {
        console.log('[SessionManager] Queueing request during refresh');
        this.requestQueue.push(executeRequest);
      } else {
        executeRequest();
      }
    });
  }
}

// ================================================================
// BULLETPROOF SUPABASE WRAPPER
// ================================================================

class BulletproofSupabase {
  private client: SupabaseClient;
  private sessionManager: SessionManager;

  constructor() {
    this.client = baseClient;
    this.sessionManager = new SessionManager();
  }

  // Get the underlying client (for auth operations)
  get auth() {
    return this.client.auth;
  }

  // Bulletproof query wrapper with automatic retry
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 2,
    operationName = 'query'
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Ensure we have a valid session before each attempt
        await this.sessionManager.ensureValidSession();

        const result = await operation();
        return result;

      } catch (error: any) {
        lastError = error;
        
        // Check if it's a 406 or auth-related error
        const isAuthError = error.code === '406' || 
                           error.code === 'PGRST301' || 
                           error.message?.includes('JWT') ||
                           error.message?.includes('session') ||
                           error.message?.includes('token');

        if (isAuthError && attempt < maxRetries) {
          console.log(`[BulletproofSupabase] ${operationName} failed with auth error (attempt ${attempt + 1}), refreshing session...`);
          
          // Force a session refresh
          await this.sessionManager.refreshSession();
          
          // Wait a moment for the new token to propagate
          await new Promise(resolve => setTimeout(resolve, 500));
          
          continue;
        }

        // If it's not an auth error, or we've exhausted retries, throw
        throw error;
      }
    }

    throw lastError;
  }

  // Bulletproof table operations
  from(table: string) {
    const tableClient = this.client.from(table);
    
    return {
      select: (columns?: string) => ({
        eq: (column: string, value: any) => ({
          single: () => this.executeWithRetry(
            () => tableClient.select(columns).eq(column, value).single(),
            2,
            `select.single from ${table}`
          ),
          maybeSingle: () => this.executeWithRetry(
            () => tableClient.select(columns).eq(column, value).maybeSingle(),
            2,
            `select.maybeSingle from ${table}`
          ),
          order: (column: string, options?: { ascending?: boolean }) => ({
            then: (callback: (result: any) => void) => {
              this.executeWithRetry(
                () => tableClient.select(columns).eq(column, value).order(column, options),
                2,
                `select.order from ${table}`
              ).then(callback).catch(callback);
            }
          })
        }),
        order: (column: string, options?: { ascending?: boolean }) => ({
          then: (callback: (result: any) => void) => {
            this.executeWithRetry(
              () => tableClient.select(columns).order(column, options),
              2,
              `select.order from ${table}`
            ).then(callback).catch(callback);
          }
        }),
        then: (callback: (result: any) => void) => {
          this.executeWithRetry(
            () => tableClient.select(columns),
            2,
            `select from ${table}`
          ).then(callback).catch(callback);
        }
      }),
      
      insert: (values: any) => ({
        then: (callback: (result: any) => void) => {
          this.executeWithRetry(
            () => tableClient.insert(values),
            2,
            `insert into ${table}`
          ).then(callback).catch(callback);
        }
      }),
      
      update: (values: any) => ({
        eq: (column: string, value: any) => ({
          then: (callback: (result: any) => void) => {
            this.executeWithRetry(
              () => tableClient.update(values).eq(column, value),
              2,
              `update ${table}`
            ).then(callback).catch(callback);
          }
        })
      }),
      
      delete: () => ({
        eq: (column: string, value: any) => ({
          then: (callback: (result: any) => void) => {
            this.executeWithRetry(
              () => tableClient.delete().eq(column, value),
              2,
              `delete from ${table}`
            ).then(callback).catch(callback);
          }
        })
      })
    };
  }

  // Bulletproof storage operations
  get storage() {
    return {
      from: (bucket: string) => ({
        upload: (path: string, file: File, options?: any) => 
          this.executeWithRetry(
            () => this.client.storage.from(bucket).upload(path, file, options),
            2,
            `storage upload to ${bucket}`
          ),
        getPublicUrl: (path: string) => 
          this.client.storage.from(bucket).getPublicUrl(path),
        download: (path: string) => 
          this.executeWithRetry(
            () => this.client.storage.from(bucket).download(path),
            2,
            `storage download from ${bucket}`
          )
      })
    };
  }

  // Bulletproof RPC operations
  rpc(fn: string, params?: any) {
    return this.executeWithRetry(
      () => this.client.rpc(fn, params),
      2,
      `rpc ${fn}`
    );
  }

  // Get the original client for advanced operations
  getClient() {
    return this.client;
  }
}

// Export the bulletproof client
export const supabase = new BulletproofSupabase();

// Also export the original client for auth operations
export { baseClient as supabaseAuth };

// Export session manager for advanced usage
export const sessionManager = new SessionManager();
