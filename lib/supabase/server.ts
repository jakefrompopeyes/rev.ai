import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  // Get cookies lazily to avoid build-time errors
  const getCookies = () => {
    try {
      return cookies();
    } catch {
      return null;
    }
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookieStore = getCookies();
          return cookieStore?.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            const cookieStore = getCookies();
            cookieStore?.set({ name, value, ...options });
          } catch {
            // Handle cookies in read-only context (e.g., middleware)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const cookieStore = getCookies();
            cookieStore?.set({ name, value: '', ...options });
          } catch {
            // Handle cookies in read-only context
          }
        },
      },
    }
  );
}

/**
 * Get the current authenticated user
 */
export async function getUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

/**
 * Get the current session
 */
export async function getSession() {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return null;
  }
  
  return session;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}


