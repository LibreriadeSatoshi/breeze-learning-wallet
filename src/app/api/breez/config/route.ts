import { NextResponse } from 'next/server';

/**
 * Server-side API route to provide Breez SDK configuration.
 * This keeps the API key out of the client-side bundle while still
 * allowing the browser-based SDK to access it at runtime.
 */
export async function GET() {
  const apiKey = process.env.BREEZ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Breez API key not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    apiKey,
  });
}
