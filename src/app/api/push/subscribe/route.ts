import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription } from '@/lib/push';

export async function POST(req: NextRequest) {
  try {
    const { tokenId, subscription } = await req.json();

    if (!tokenId || !subscription) {
      return NextResponse.json(
        { success: false, error: 'tokenId and subscription payload are required' },
        { status: 400 }
      );
    }

    await savePushSubscription(tokenId, subscription);

    return NextResponse.json({ success: true, message: 'Push subscription registered successfully' });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
