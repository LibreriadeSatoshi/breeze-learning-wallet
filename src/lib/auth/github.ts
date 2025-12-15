import { supabase } from '@/lib/supabase/client';

export interface GitHubUser {
  id: string;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}


export async function loginWithGitHub(): Promise<void> {
  try {
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/github/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('GitHub OAuth error:', error);
      alert('Failed to initiate GitHub login. Please try again.');
      return;
    }
  } catch (error) {
    console.error('Error initiating GitHub login:', error);
    alert('Failed to initiate GitHub login. Please try again.');
  }
}

export async function getSupabaseSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
}

export async function getSupabaseUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

export function supabaseUserToGitHubUser(user: any): GitHubUser | null {
  if (!user) return null;

  const userMetadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};

  return {
    id: user.id,
    login: userMetadata.user_name || userMetadata.preferred_username || user.email?.split('@')[0] || '',
    name: userMetadata.full_name || userMetadata.name || user.email || '',
    email: user.email || '',
    avatar_url: userMetadata.avatar_url || userMetadata.picture || '',
  };
}
