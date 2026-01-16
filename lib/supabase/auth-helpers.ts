import { createClient, getUser } from './server';
import { prisma } from '@/lib/db';

/**
 * Development mode organization ID - uses first org in database or creates one
 */
async function getDevOrganizationId(): Promise<string> {
  // Try to find an existing organization
  const existingOrg = await prisma.organization.findFirst({
    select: { id: true },
  });
  
  if (existingOrg) {
    return existingOrg.id;
  }
  
  // Create a new organization for development
  const newOrg = await prisma.organization.create({
    data: {
      name: 'Development Organization',
      users: {
        create: {
          email: 'dev@localhost',
          name: 'Developer',
        },
      },
    },
  });
  
  return newOrg.id;
}

/**
 * Get the organization ID for the current authenticated user
 */
export async function getOrganizationId(): Promise<string | null> {
  const user = await getUser();
  
  if (!user?.email) {
    return null;
  }

  // Find the user in our database
  const dbUser = await prisma.user.findFirst({
    where: { email: user.email },
    select: { organizationId: true },
  });

  return dbUser?.organizationId || null;
}

/**
 * Require authentication and return organization ID
 * In development mode, falls back to dev org if not authenticated
 */
export async function requireAuthWithOrg(): Promise<{
  userId: string;
  email: string;
  organizationId: string;
}> {
  const user = await getUser();
  
  if (!user?.email) {
    // Development fallback
    if (process.env.NODE_ENV !== 'production') {
      const devOrgId = await getDevOrganizationId();
      return {
        userId: 'dev-user',
        email: 'dev@localhost',
        organizationId: devOrgId,
      };
    }
    throw new Error('Unauthorized');
  }

  // Find or create user in our database
  let dbUser = await prisma.user.findFirst({
    where: { email: user.email },
    select: { id: true, organizationId: true },
  });

  if (!dbUser) {
    // Create organization and user record
    const companyName = user.user_metadata?.company_name || 
                      user.user_metadata?.name || 
                      user.email.split('@')[0];
    
    const org = await prisma.organization.create({
      data: {
        name: `${companyName}'s Organization`,
        users: {
          create: {
            email: user.email,
            name: user.user_metadata?.name || null,
          },
        },
      },
      include: { users: true },
    });

    dbUser = {
      id: org.users[0].id,
      organizationId: org.id,
    };
  }

  return {
    userId: user.id,
    email: user.email,
    organizationId: dbUser.organizationId,
  };
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}


