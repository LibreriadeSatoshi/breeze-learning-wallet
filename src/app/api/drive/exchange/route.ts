import { NextRequest, NextResponse } from "next/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
};

export async function POST(req: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth is not configured on the server." },
      { status: 500 },
    );
  }

  let body: { code?: string; redirectUri?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { code, redirectUri } = body;
  if (!code || !redirectUri) {
    return NextResponse.json(
      { error: "Missing code or redirectUri" },
      { status: 400 },
    );
  }

  const form = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const upstream = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const data = (await upstream.json().catch(() => ({}))) as TokenResponse;

  if (!upstream.ok || data.error) {
    return NextResponse.json(
      { error: data.error_description ?? data.error ?? "Token exchange failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  });
}
