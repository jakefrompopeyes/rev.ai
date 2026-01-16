import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Middleware runs in the Edge runtime. Some Supabase packages can trigger
  // Node.js API usage warnings (and may fail at runtime depending on versions).
  // To avoid the entire app appearing "stuck loading", fail open if session
  // refresh/auth redirects can't run here.
  try {
    const { updateSession } = await import('@/lib/supabase/middleware');
    return await updateSession(request);
  } catch (error) {
    console.warn('Middleware session update skipped:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};


