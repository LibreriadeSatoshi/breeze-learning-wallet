# GitHub OAuth2 Authentication Setup

This guide explains how to set up GitHub OAuth2 authentication for EttaWallet.

## Features

- **Secure Authentication**: Users can log in with their GitHub account
- **No Password Management**: Leverage GitHub's secure authentication
- **Quick Onboarding**: One-click wallet access
- **Profile Integration**: Access to user's GitHub profile information

## Setup Instructions

### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the application details:
   - **Application name**: `EttaWallet` (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Click **"Register application"**

### 2. Get Your Credentials

After creating the app, you'll see:
- **Client ID**: Copy this value
- **Client Secret**: Click "Generate a new client secret" and copy the value

⚠️ **Important**: Save the client secret immediately - you won't be able to see it again!

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your GitHub credentials:
   ```env
   NEXT_PUBLIC_GITHUB_CLIENT_ID=your_actual_client_id_here
   GITHUB_CLIENT_SECRET=your_actual_client_secret_here
   ```

3. **Never commit `.env.local`** - it's already in `.gitignore`

### 4. Production Setup

When deploying to production:

1. **Update OAuth App Settings** in GitHub:
   - Homepage URL: `https://your-production-domain.com`
   - Callback URL: `https://your-production-domain.com/auth/github/callback`

2. **Set Environment Variables** in your hosting platform:
   - Vercel: Settings → Environment Variables
   - Netlify: Site settings → Build & deploy → Environment
   - Other platforms: Follow their documentation

## How It Works

### Authentication & Authorization Flow

```
┌─────────┐      ┌────────┐      ┌──────────┐      ┌─────────┐      ┌──────────┐
│  User   │─────>│ Etta   │─────>│  GitHub  │─────>│  Etta   │─────>│ External │
│ Clicks  │      │ Wallet │      │   Auth   │      │  API    │      │    DB    │
└─────────┘      └────────┘      └──────────┘      └─────────┘      └──────────┘
                     ↓                                    ↓                ↓
              Redirects to              Exchange code for token    Check email
              GitHub OAuth              Get user profile           authorization
                     ↓                                    ↓                ↓
                  Returns                          Check if email   Return user
                  with code                        is authorized    data if OK
                     ↓                                    ↓
                                                   Store auth state
                                                   Redirect to welcome
```

1. **User clicks "Continue with GitHub"**
   - App redirects to GitHub OAuth page
   - GitHub shows authorization screen

2. **User authorizes the app**
   - GitHub redirects back with authorization code
   - App exchanges code for access token (server-side)

3. **App fetches user profile**
   - Uses access token to get GitHub user data
   - Extracts user's email address

4. **Email Authorization Check**
   - App queries external database with user's email
   - Database returns authorization status and user data
   - If not authorized: User sees error message, "Create wallet" button disabled
   - If authorized: User can create wallet

5. **User is logged in**
   - Redirected to welcome page
   - Authorization status shown
   - Session persists across page refreshes

### Security Features

- **State Parameter**: CSRF protection using random state
- **Server-Side Token Exchange**: Client secret never exposed to browser
- **Session Storage**: Temporary state stored in sessionStorage
- **Scopes**: Only requests minimal permissions (read:user, user:email)

## API Endpoints

### POST `/api/auth/github`

Exchanges authorization code for access token.

**Request:**
```json
{
  "code": "authorization_code_from_github"
}
```

**Response:**
```json
{
  "access_token": "github_access_token"
}
```

### Client-Side Functions

Located in `src/lib/auth/github.ts`:

- `loginWithGitHub()` - Initiates OAuth flow
- `exchangeCodeForToken(code, state)` - Exchanges code for token
- `getGitHubUser(token)` - Fetches user profile
- `storeGitHubSession(user, token)` - Saves session
- `getGitHubSession()` - Retrieves session
- `clearGitHubSession()` - Logs out user

## Usage in Components

```tsx
import { loginWithGitHub, getGitHubSession } from '@/lib/auth/github';

// Login
const handleLogin = () => {
  loginWithGitHub();
};

// Check session
const session = getGitHubSession();
if (session) {
  console.log('Logged in as:', session.user.login);
}
```

## Troubleshooting

### "GitHub authentication is not configured"

- Make sure `NEXT_PUBLIC_GITHUB_CLIENT_ID` is set in `.env.local`
- Restart the dev server after adding environment variables

### "Invalid state parameter"

- This is CSRF protection working correctly
- Usually happens if you refresh the callback page
- Click "Continue with GitHub" again to restart the flow

### "Failed to exchange code for token"

- Check that `GITHUB_CLIENT_SECRET` is correctly set
- Verify the client secret in GitHub settings
- Make sure you're using the correct OAuth app

### Callback URL mismatch

- Ensure the callback URL in GitHub matches exactly: `http://localhost:3000/auth/github/callback`
- For production, update to your production domain
- No trailing slashes

## Testing

1. Start the dev server:
   ```bash
   yarn dev
   ```

2. Navigate to `http://localhost:3000/welcome`

3. Click **"Continue with GitHub"**

4. Authorize the app on GitHub

5. You should be redirected to `/wallet/home` with your session stored

## Permissions Requested

The app requests these GitHub scopes:

- `read:user` - Read user profile information
- `user:email` - Read user email addresses

These are minimal permissions needed for basic authentication.

## Privacy & Data

- **No wallet data is sent to GitHub**
- GitHub authentication is only used for user identity
- Wallet keys and transactions remain local or encrypted
- GitHub only sees: "EttaWallet requested access to your account"

## Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [OAuth 2.0 Spec](https://oauth.net/2/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
