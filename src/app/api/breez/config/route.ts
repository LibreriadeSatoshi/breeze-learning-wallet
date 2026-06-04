import { NextResponse } from 'next/server';

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
