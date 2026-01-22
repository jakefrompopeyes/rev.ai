# Google OAuth Setup Guide

This guide will help you configure Google OAuth authentication for your application using Supabase.

## Prerequisites

- A Supabase project (get one at [supabase.com](https://supabase.com))
- A Google Cloud Project with OAuth 2.0 credentials

## Step 1: Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in the required information (App name, User support email, Developer contact)
   - Add scopes: `email`, `profile`, `openid`
   - Add test users if your app is in testing mode
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: Your app name (e.g., "Rev.AI")
   - Authorized redirect URIs: Add your Supabase redirect URL:
     ```
     https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
     ```
     Replace `YOUR_PROJECT_REF` with your Supabase project reference (found in your Supabase project URL)
7. Click **Create**
8. Copy the **Client ID** and **Client Secret** (you'll need these for Supabase)

## Step 2: Configure Google OAuth in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Google provider** to ON
6. Enter your Google OAuth credentials:
   - **Client ID (for OAuth)**: Paste the Client ID from Google Cloud Console
   - **Client Secret (for OAuth)**: Paste the Client Secret from Google Cloud Console
7. Click **Save**

## Step 3: Verify Redirect URI

Make sure your Google OAuth redirect URI in Google Cloud Console matches:
```
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

You can find your project reference in:
- Your Supabase project URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
- Or in your Supabase project settings

## Step 4: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```
2. Navigate to your login page
3. Click **Continue with Google**
4. You should be redirected to Google's sign-in page
5. After signing in, you should be redirected back to your app

## Troubleshooting

### "Redirect URI mismatch" error

- Ensure the redirect URI in Google Cloud Console exactly matches:
  `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- Check that there are no trailing slashes or typos
- Make sure you're using the correct project reference

### "Invalid client" error

- Verify that the Client ID and Client Secret in Supabase match your Google Cloud Console credentials
- Ensure the OAuth consent screen is properly configured
- Check that your Google Cloud project has the OAuth 2.0 API enabled

### User not created in database

- Check that the callback handler (`app/auth/callback/route.ts`) is working correctly
- Verify your database connection and Prisma schema
- Check server logs for any errors during user creation

### OAuth consent screen issues

- If your app is in testing mode, make sure to add test users in Google Cloud Console
- For production, you'll need to submit your app for verification if you request sensitive scopes

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Google Provider Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)

## Security Notes

- Never commit your Client Secret to version control
- Use environment variables for sensitive data (though Supabase handles OAuth secrets)
- Regularly rotate your OAuth credentials
- Monitor OAuth usage in Google Cloud Console for suspicious activity
