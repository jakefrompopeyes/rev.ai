import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const redirect = searchParams.get('redirect') || '/dashboard';

  // Handle OAuth errors from provider
  if (error) {
    const errorMessage = errorDescription 
      ? decodeURIComponent(errorDescription)
      : 'Authentication failed. Please try again.';
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorMessage)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('No authorization code received')}`
    );
  }

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { prisma } = await import('@/lib/db');
    
    const supabase = createClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message || 'Failed to authenticate')}`
      );
    }
    
    if (!data.user) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('No user data received')}`
      );
    }

    // Check if user has an organization, if not create one
    const existingUser = await prisma.user.findFirst({
      where: { email: data.user.email },
    });

    if (!existingUser && data.user.email) {
      // Create organization and user record
      // For Google OAuth, user metadata may contain full_name or name
      const userName = data.user.user_metadata?.full_name || 
                      data.user.user_metadata?.name ||
                      data.user.user_metadata?.email?.split('@')[0] ||
                      data.user.email.split('@')[0];
      
      const companyName = data.user.user_metadata?.company_name || 
                         data.user.user_metadata?.organization ||
                         userName;
      
      const { isFreeMode } = await import('@/lib/env');
      await prisma.organization.create({
        data: {
          name: `${companyName}'s Organization`,
          isComped: isFreeMode(),
          compedTier: isFreeMode() ? 'SCALE' : null,
          compedReason: isFreeMode() ? 'Free mode enabled' : null,
          users: {
            create: {
              email: data.user.email,
              name: userName,
            },
          },
        },
      });
    }

    return NextResponse.redirect(`${origin}${redirect}`);
  } catch (err) {
    console.error('Unexpected error in auth callback:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorMessage)}`
    );
  }
}


