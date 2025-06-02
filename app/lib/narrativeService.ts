// FILE: app/lib/narrativeService.ts
import type { ResourceGenerationEpic } from '@/src/types/tools';

import defaultHomeNarrativeData from '@/app/lib/directives/home/_data/generation.json';

const narrativeCache = new Map<string, ResourceGenerationEpic | null>();
let defaultHomeNarrative: ResourceGenerationEpic | null = null;

try {
  if (defaultHomeNarrativeData) {
    defaultHomeNarrative = defaultHomeNarrativeData as ResourceGenerationEpic;
    narrativeCache.set('home', defaultHomeNarrative);
  } else {
    console.warn('Default home narrative data module is empty or undefined.');
  }
} catch (e) {
  console.error('Error processing imported default home narrative data:', e);
}

async function fetchAndCacheNarrative(
  directive: string
): Promise<ResourceGenerationEpic | null> {
  if (narrativeCache.has(directive)) {
    return narrativeCache.get(directive) || null;
  }

  try {
    const narrativeModule = await import(
      `@/app/lib/directives/${directive}/_data/generation.json`
    );
    const narrative = narrativeModule.default as ResourceGenerationEpic;
    narrativeCache.set(directive, narrative);
    return narrative;
  } catch (_error) {
    narrativeCache.set(directive, null);
    return null;
  }
}
export async function getResourceGenerationEpic(
  directive: string
): Promise<ResourceGenerationEpic | null> {
  if (directive === 'home') {
    return defaultHomeNarrative;
  }

  if (narrativeCache.has(directive)) {
    const cached = narrativeCache.get(directive);
    return cached === undefined ? null : cached;
  }

  const specificNarrative = await fetchAndCacheNarrative(directive);
  if (specificNarrative) {
    return specificNarrative;
  }

  return defaultHomeNarrative;
}

export function getDefaultHomeNarrativeSync(): ResourceGenerationEpic | null {
  return defaultHomeNarrative;
}
