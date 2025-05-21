// FILE: app/api/get-emojis/route.ts
import { NextResponse } from 'next/server';
import { getEmojis, RichEmojiData } from '@/src/constants/emojis';

export async function GET() {
  try {
    const emojis: RichEmojiData[] = await getEmojis();

    return NextResponse.json({ emojis: emojis ?? [] });
  } catch (error) {
    console.error('[API /get-emojis] Error fetching emojis:', error);
    return NextResponse.json(
      { error: 'Failed to load emoji data.', emojis: [] },
      { status: 500 }
    );
  }
}
