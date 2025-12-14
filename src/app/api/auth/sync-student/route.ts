import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { SupabaseErrorCode } from '@/lib/supabase/errors';

export async function POST(request: NextRequest) {
  try {
    const { email, githubUsername } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const { data: existingStudent, error: fetchError } = await supabase
      .from('students')
      .select('id, email, github_username')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== SupabaseErrorCode.NOT_FOUND) {
      console.error('Error checking existing student:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check existing student' },
        { status: 500 }
      );
    }

    if (existingStudent) {
      if (githubUsername && existingStudent.github_username !== githubUsername) {
        const { data: updatedStudent, error: updateError } = await supabase
          .from('students')
          .update({ github_username: githubUsername })
          .eq('id', existingStudent.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating student:', updateError);
          return NextResponse.json(
            { error: 'Failed to update student' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          student: updatedStudent,
          created: false,
        });
      }

      return NextResponse.json({
        success: true,
        student: existingStudent,
        created: false,
      });
    }

    const { data: newStudent, error: insertError } = await supabase
      .from('students')
      .insert({
        email,
        github_username: githubUsername || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating student:', insertError);
      return NextResponse.json(
        { error: 'Failed to create student', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      student: newStudent,
      created: true,
    });
  } catch (error: any) {
    console.error('Sync student API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

