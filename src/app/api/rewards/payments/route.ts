import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import type { PaymentsStatusResponse } from '@/types/payments';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('email', email)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const { data: paymentsEvents, error: paymentsError } = await supabase
      .from('payments')
      .select('status')
      .eq('student_id', student.id)
      .single();

    if (paymentsError) {
      console.error('Error fetching payments events:', paymentsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payments events' },
        { status: 500 }
      );
    }

    const response: PaymentsStatusResponse = {
       status: paymentsEvents.status
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('payments API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

