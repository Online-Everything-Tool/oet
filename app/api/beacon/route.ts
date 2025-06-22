// FILE: app/api/beacon/route.ts
import { type NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Beacon received:', body.event);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error processing beacon:', error);
    return new NextResponse(null, { status: 204 });
  }
}
