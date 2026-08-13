import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: { tokenId: string } }
) {
  try {
    const { tokenId } = params;
    const body = await request.json();
    const { status } = body; // 'SERVING', 'COMPLETED', or 'CANCELLED'

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // ==========================================
    // TODO: ADD YOUR DATABASE LOGIC HERE
    // Example (Prisma): 
    // await prisma.token.update({
    //   where: { id: tokenId },
    //   data: { status }
    // });
    // ==========================================

    console.log(`Updated token ${tokenId} to ${status}`);

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Error updating token status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}