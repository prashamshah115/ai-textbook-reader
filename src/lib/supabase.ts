// 🔥 PHASE 0: Direct Supabase client (retry logic removed after RLS fixes)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper function to check if user is whitelisted
export async function isUserWhitelisted(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('allowed_users')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[Auth] Whitelist check failed:', error);
    return false;
  }

  return !!data;
}