import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import type { ClaimRewardsResponse } from '@/types/rewards';

export async function POST(request: NextRequest) {
  try {
    const { email, rewardEventIds, bolt11 } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!rewardEventIds || !Array.isArray(rewardEventIds) || rewardEventIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reward event IDs are required' },
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

    const { data: rewardEvents, error: rewardsError } = await supabase
      .from('reward_events')
      .select(`
        id,
        reward_id,
        rewards!inner (
          id,
          amount_sats,
          is_active
        ),
        payments (
          id,
          status
        )
      `)
      .eq('student_id', student.id)
      .in('id', rewardEventIds)
      .eq('rewards.is_active', true);

    if (rewardsError) {
      console.error('Error fetching reward events:', rewardsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch reward events' },
        { status: 500 }
      );
    }

    const claimableRewards = (rewardEvents || []).filter((re: any) => {
      const payments = re.payments || [];
      return !payments.some((p: any) => p.status === 'settled');
    });

    if (claimableRewards.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No claimable rewards found' },
        { status: 400 }
      );
    }

    const totalAmountSats = claimableRewards.reduce(
      (sum: number, re: any) => sum + re.rewards.amount_sats,
      0
    );

    const paymentRecords = {
      student_id: student.id,
      reward_event_id: claimableRewards[0].id,
      amount_sats: totalAmountSats,
      status: 'created',
      invoice_bolt11: bolt11
    };

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .insert(paymentRecords)
      .select('id');

    if (paymentsError || !payments) {
      console.error('Error creating payments:', paymentsError);
      return NextResponse.json(
        { success: false, error: 'Failed to create payment records' },
        { status: 500 }
      );
    }

    const response: ClaimRewardsResponse = {
      success: true,
      paymentId: payments[0]?.id,
      amountSats: totalAmountSats,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Claim rewards API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

