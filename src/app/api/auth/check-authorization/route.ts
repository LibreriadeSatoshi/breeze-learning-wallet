import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { SupabaseErrorCode } from '@/lib/supabase/errors';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, email, github_username, created_at')
      .eq('email', email)
      .single();

    if (studentError) {
      if (studentError.code === SupabaseErrorCode.NOT_FOUND) {
        return NextResponse.json({
          authorized: false,
          message: 'Email not found in database',
        });
      }

      console.error('Error checking student:', studentError);
      return NextResponse.json(
        { error: 'Failed to check authorization' },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json({
        authorized: false,
        message: 'Email not authorized to create wallet',
      });
    }

    return NextResponse.json({
      authorized: true,
      userData: student,
    });
  } catch (error) {
    console.error('Authorization check error:', error);
    return NextResponse.json(
      { error: 'Failed to check authorization' },
      { status: 500 }
    );
  }
}
