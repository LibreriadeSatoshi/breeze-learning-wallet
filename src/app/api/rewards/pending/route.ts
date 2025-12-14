import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import type { RewardsResponse, PendingReward } from '@/types/rewards';

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
      .select('id')
      .eq('email', email)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found', totalSats: 0, rewards: [] },
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
          is_active,
          content_id,
          content!inner (
            id,
            title,
            content_type
          )
        ),
        payments (
          id,
          status
        )
      `)
      .eq('student_id', student.id);

    if (rewardsError) {
      console.error('Error fetching rewards:', rewardsError);
      return NextResponse.json(
        { error: 'Failed to fetch rewards', totalSats: 0, rewards: [] },
        { status: 500 }
      );
    }

    const pendingRewards: PendingReward[] = (rewardEvents || [])
      .filter((re: any) => {
        if (!re.rewards?.is_active) return false;

        const payments = re.payments || [];
        return !payments.some((p: any) => p.status === 'settled');
      })
      .map((re: any) => ({
        rewardEventId: re.id,
        rewardId: re.reward_id,
        contentId: re.rewards.content.id,
        contentTitle: re.rewards.content.title,
        contentType: re.rewards.content.content_type,
        amountSats: re.rewards.amount_sats,
      }));

    const totalSats = pendingRewards.reduce(
      (sum, reward) => sum + reward.amountSats,
      0
    );

    const response: RewardsResponse = {
      totalSats,
      rewards: pendingRewards,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Pending rewards API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', totalSats: 0, rewards: [] },
      { status: 500 }
    );
  }
}

