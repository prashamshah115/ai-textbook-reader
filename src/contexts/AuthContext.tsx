import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isUserWhitelisted } from '../lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isWhitelisted: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);

  // Check whitelist status
  const checkWhitelist = async (email: string) => {
    const whitelisted = await isUserWhitelisted(email);
    setIsWhitelisted(whitelisted);
    return whitelisted;
  };

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user?.email) {
        await checkWhitelist(session.user.email);
      }
      
      setLoading(false);
    });

    // Listen for auth changes with detailed event handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event);
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('✅ [Auth] Token refreshed successfully');
      }
      
      if (event === 'SIGNED_OUT' || !session) {
        setIsWhitelisted(false);
        console.log('🔴 [Auth] Session ended');
      }
      
      if (session?.user?.email) {
        await checkWhitelist(session.user.email);
      } else {
        setIsWhitelisted(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Proactive session refresh - refresh 5 minutes before expiry
  useEffect(() => {
    const checkAndRefresh = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.warn('[Auth] No valid session');
          return;
        }

        // Check if session expires soon (within 5 minutes)
        const expiresAt = new Date(session.expires_at!).getTime();
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        const fiveMinutes = 5 * 60 * 1000;

        if (timeUntilExpiry < fiveMinutes) {
          console.log('[Auth] Session expiring soon, refreshing proactively...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('[Auth] Failed to refresh session:', refreshError);
          } else {
            console.log('✅ [Auth] Session refreshed proactively');
          }
        } else {
          console.log(`[Auth] Session valid for ${Math.round(timeUntilExpiry / 60000)} more minutes`);
        }
      } catch (error) {
        console.error('[Auth] Session check error:', error);
      }
    };

    // Check immediately on mount
    checkAndRefresh();

    // Then check every minute
    const interval = setInterval(checkAndRefresh, 60000);

    return () => clearInterval(interval);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // First check if user is whitelisted
      const whitelisted = await isUserWhitelisted(email);
      
      if (!whitelisted) {
        return {
          success: false,
          error: 'Your email is not authorized. Please contact the administrator for access.',
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setIsWhitelisted(true);
        toast.success('Welcome back!');
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error) {
      const authError = error as AuthError;
      console.error('[Auth] Sign in error:', authError);
      return {
        success: false,
        error: authError.message || 'Failed to sign in',
      };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // Check if user is whitelisted before allowing signup
      const whitelisted = await isUserWhitelisted(email);
      
      if (!whitelisted) {
        return {
          success: false,
          error: 'Your email is not authorized. Please contact the administrator for access.',
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create default user preferences
        const { error: prefError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: data.user.id,
            learning_goals: '',
            target_level: 'intermediate',
            preferred_summary_style: 'concise',
          });

        if (prefError) {
          console.error('[Auth] Failed to create user preferences:', prefError);
        }

        toast.success('Account created! Please check your email to confirm.');
        return { success: true };
      }

      return { success: false, error: 'Signup failed' };
    } catch (error) {
      const authError = error as AuthError;
      console.error('[Auth] Sign up error:', authError);
      return {
        success: false,
        error: authError.message || 'Failed to sign up',
      };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setIsWhitelisted(false);
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isWhitelisted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

