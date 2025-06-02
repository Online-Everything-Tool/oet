// FILE: app/api/status/route.ts
import { ApiStatusResponse } from '@/src/types/build';
import { NextResponse } from 'next/server';

export async function GET() {
  const responsePayload: ApiStatusResponse = {
    globalStatus: 'operational',
    featureFlags: {
      favoritesEnabled: true,
      recentlyUsedEnabled: true,
      recentBuildsEnabled: true,
      buildToolEnabled: true,
    },
    services: {
      githubApi: 'operational',
      aiServices: 'operational',
    },
    message: 'All systems operational. Header features enabled.',
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(responsePayload);
}
