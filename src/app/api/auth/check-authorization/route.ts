/**
 * Email Authorization Check API
 * Checks if user's email is authorized in external database
 */

import { NextRequest, NextResponse } from 'next/server';

// Configure your external database connection here
const EXTERNAL_DB_URL = process.env.EXTERNAL_DB_URL || '';
const EXTERNAL_DB_API_KEY = process.env.EXTERNAL_DB_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!EXTERNAL_DB_URL) {
      console.warn('External DB URL not configured, allowing all users for development');
      // For development: allow all users
      return NextResponse.json({
        authorized: true,
        userData: {
          email,
          allowedAt: new Date().toISOString(),
        },
      });
    }

    // Check authorization in external database
    const response = await fetch(`${EXTERNAL_DB_URL}/check-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXTERNAL_DB_API_KEY}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Email not found in database
        return NextResponse.json({
          authorized: false,
          message: 'Email not authorized to create wallet',
        });
      }

      throw new Error('Failed to check authorization');
    }

    const userData = await response.json();

    return NextResponse.json({
      authorized: true,
      userData,
    });
  } catch (error) {
    console.error('Authorization check error:', error);
    return NextResponse.json(
      { error: 'Failed to check authorization' },
      { status: 500 }
    );
  }
}
