import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/dashboard';

  if (code) {
    const { createClient } = await import('@/lib/supabase/server');
    const { prisma } = await import('@/lib/db');
    
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Check if user has an organization, if not create one
      const existingUser = await prisma.user.findFirst({
        where: { email: data.user.email },
      });

      if (!existingUser && data.user.email) {
        // Create organization and user record
        const companyName = data.user.user_metadata?.company_name || 
                          data.user.user_metadata?.name || 
                          data.user.email.split('@')[0];
        
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
                name: data.user.user_metadata?.name || null,
              },
            },
          },
        });
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}


