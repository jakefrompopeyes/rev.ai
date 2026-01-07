import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/dashboard';

  if (code) {
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
        
        await prisma.organization.create({
          data: {
            name: `${companyName}'s Organization`,
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


