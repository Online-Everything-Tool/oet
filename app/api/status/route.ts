// FILE: app/api/status/route.ts
import { NextResponse } from 'next/server';

export interface ApiStatusResponse {
  globalStatus: 'operational' | 'degraded' | 'maintenance';
  featureFlags: {
    favoritesEnabled: boolean;
    recentlyUsedEnabled: boolean;
    recentBuildsEnabled: boolean;
    buildToolEnabled: boolean;
  };
  services?: {
    githubApi?: 'operational' | 'degraded' | 'down';
    aiServices?: 'operational' | 'degraded' | 'down';
  };
  message?: string;
  timestamp: string;
}

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
