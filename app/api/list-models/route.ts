// FILE: app/api/list-models/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Remove fs and path imports if they are no longer needed elsewhere in this file
// import fs from 'fs/promises';
// import path from 'path';

// Import the JSON data directly.
// Make sure your tsconfig.json has "resolveJsonModule": true (it usually does by default in Next.js projects)
import excludedModelData from './_data/exclude.json';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error(
    'FATAL ERROR (list-models): GEMINI_API_KEY environment variable is not set.'
  );
}

const MIN_INPUT_TOKEN_LIMIT_FOR_CODE_GEN = 100000;

// The EXCLUDE_FILE_PATH constant is no longer needed for reading the file content
// const EXCLUDE_FILE_PATH = path.join( /* ... */ );

let excludedModelNamesCache = new Set<string>();

// Simpler function to get excluded models now that we import directly
function getExcludedModelsSet(): Set<string> {
  // If you want to retain the caching behavior (e.g., if exclude.json could change *during runtime*
  // without a redeploy, which is unlikely for a committed file), you can keep it.
  // Otherwise, for a static import, you can simplify this.

  // Simplest approach: always derive from the imported data.
  // If exclude.json can change and you want to pick up changes without redeploy (not typical),
  // you'd need fs.readFile. But for a bundled file, direct import is fine.
  if (excludedModelNamesCache.size === 0 && excludedModelData.length > 0) {
    // Initialize cache once from imported data
    excludedModelNamesCache = new Set(
      excludedModelData.map((m: { name: string }) => m.name)
    );
    console.log(
      `[API /list-models] Initialized exclude.json cache from direct import. ${excludedModelNamesCache.size} models excluded.`
    );
  } else if (
    excludedModelData.length === 0 &&
    excludedModelNamesCache.size > 0
  ) {
    // If the imported file is empty but cache had data (e.g. from a previous hot reload with a different file)
    excludedModelNamesCache = new Set();
    console.log(
      `[API /list-models] Imported exclude.json is empty. Resetting cache.`
    );
  }
  // If you want to keep the time-based cache refresh (less relevant for static import):
  // const now = Date.now();
  // if (now - lastExcludeFileReadTime > EXCLUDE_CACHE_DURATION || excludedModelNamesCache.size === 0) {
  //   excludedModelNamesCache = new Set(excludedModelData.map((m: { name: string }) => m.name));
  //   lastExcludeFileReadTime = now;
  //   console.log(
  //     `[API /list-models] Refreshed exclude.json cache from direct import. ${excludedModelNamesCache.size} models excluded.`
  //   );
  // }
  return excludedModelNamesCache;
}

// Optionally, initialize the cache once when the module loads if you don't need time-based refresh
// getExcludedModelsSet(); // Call it once to populate the cache initially.

// ... (rest of your ModelInfo interface, parseModelNameDetails function)

interface ModelInfo {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];

  baseName?: string;
  isLatestAlias?: boolean;
  dateSuffix?: Date | null;
  numericSuffix?: number | null;
  isPreview?: boolean;
  isExperimental?: boolean;
}

function parseModelNameDetails(model: {
  name: string;
}): Pick<
  ModelInfo,
  | 'baseName'
  | 'isLatestAlias'
  | 'dateSuffix'
  | 'numericSuffix'
  | 'isPreview'
  | 'isExperimental'
> {
  const name = model.name;
  const details: Pick<
    ModelInfo,
    | 'baseName'
    | 'isLatestAlias'
    | 'dateSuffix'
    | 'numericSuffix'
    | 'isPreview'
    | 'isExperimental'
  > = {
    isLatestAlias: name.endsWith('-latest'),
    isPreview: name.includes('-preview-'),
    isExperimental: name.includes('-exp-') || name.includes('experimental'),
    dateSuffix: null,
    numericSuffix: null,
  };

  let baseName = name;
  if (details.isLatestAlias) {
    baseName = name.substring(0, name.lastIndexOf('-latest'));
  }

  const datePattern = /(?:-(\d{2})-(\d{2})(?:-(\d{4}))?)$/;
  const dateMatch = baseName.match(datePattern);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10) - 1;
    const day = parseInt(dateMatch[2], 10);
    const yearStr = dateMatch[3];
    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();

    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      details.dateSuffix = new Date(year, month, day);
      baseName = baseName.substring(0, baseName.lastIndexOf(dateMatch[0]));
    }
  } else {
    const numericMatch = baseName.match(/-(\d+)$/);
    if (numericMatch) {
      details.numericSuffix = parseInt(numericMatch[1], 10);
      baseName = baseName.substring(0, baseName.lastIndexOf(numericMatch[0]));
    }
  }
  details.baseName = baseName;
  return details;
}

export async function GET(request: NextRequest) {
  console.log('[API /list-models] Received GET request.');

  if (!API_KEY) {
    return NextResponse.json(
      { error: 'AI service configuration error (API Key missing).' },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const filterExcludedParam = searchParams.get('filterExcluded');
  const shouldFilterExcluded = filterExcludedParam !== 'false';
  const latestOnlyParam = searchParams.get('latestOnly');
  const shouldFilterForLatestOnly = latestOnlyParam !== 'false';

  let currentExcludedNames = new Set<string>();
  if (shouldFilterExcluded) {
    // The getExcludedModelsSet now directly uses the imported JSON data.
    // The caching logic within getExcludedModelsSet can be simplified or removed
    // if the data is truly static per deployment.
    currentExcludedNames = getExcludedModelsSet();
    console.log(
      `[API /list-models] Applying exclude.json filter: ${currentExcludedNames.size} model(s) currently excluded.`
    );
  } else {
    console.log(
      '[API /list-models] Not applying exclude.json filter (filterExcluded=false).'
    );
  }

  const REST_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

  try {
    const response = await fetch(REST_API_ENDPOINT);
    if (!response.ok) {
      let errorBody = `Google API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        const message = errorData?.error?.message;
        if (message) errorBody = String(message);
      } catch (_e) {
        /*ignore*/
      }
      console.error(`[API /list-models] Google API Error: ${errorBody}`);
      throw new Error(errorBody);
    }
    const data = await response.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const googleModels: any[] = data?.models || [];
    console.log(
      `[API /list-models] Received ${googleModels.length} models from Google API.`
    );

    const augmentedAndPrunedModels: ModelInfo[] = googleModels
      .map((apiModel) => {
        const parsedDetails = parseModelNameDetails(apiModel);
        return {
          name: apiModel.name,
          displayName: apiModel.displayName || apiModel.name,
          version: apiModel.version || 'unknown',
          description: apiModel.description,
          inputTokenLimit: apiModel.inputTokenLimit,
          outputTokenLimit: apiModel.outputTokenLimit,
          supportedGenerationMethods: apiModel.supportedGenerationMethods,
          ...parsedDetails,
        };
      })
      .filter((model) => {
        const modelNameLower = (model.name || '').toLowerCase();
        const displayNameLower = (model.displayName || '').toLowerCase();
        const descriptionLower = (model.description || '').toLowerCase();

        if (shouldFilterExcluded && currentExcludedNames.has(model.name))
          return false;

        if (
          !model.supportedGenerationMethods ||
          !model.supportedGenerationMethods.includes('generateContent')
        )
          return false;

        if (
          modelNameLower.includes('embedding') ||
          displayNameLower.includes('embedding')
        )
          return false;
        if (descriptionLower.includes('deprecated')) return false;
        if (modelNameLower.includes('-tuning')) return false;
        if (
          descriptionLower.includes('replaced by') ||
          modelNameLower.includes('exp-0827') ||
          modelNameLower.includes('exp-0924') ||
          modelNameLower.includes('exp-1206')
        )
          return false;
        if (
          modelNameLower.includes('-tts') ||
          displayNameLower.includes('tts') ||
          modelNameLower.includes('image-generation')
        )
          return false;
        if (
          displayNameLower.includes('thinking') ||
          descriptionLower.includes('for cursor testing')
        )
          return false;
        if ((model.inputTokenLimit || 0) < MIN_INPUT_TOKEN_LIMIT_FOR_CODE_GEN)
          return false;
        return true;
      });

    console.log(
      `[API /list-models] After initial pruning & augmentation: ${augmentedAndPrunedModels.length} models.`
    );

    let finalModelsToReturn: ModelInfo[];
    if (shouldFilterForLatestOnly) {
      console.log('[API /list-models] Applying latestOnly filter.');
      const families = new Map<string, ModelInfo[]>();
      augmentedAndPrunedModels.forEach((model) => {
        const key = model.baseName || model.name;
        if (!families.has(key)) families.set(key, []);
        families.get(key)!.push(model);
      });

      finalModelsToReturn = [];
      families.forEach((familyModels) => {
        if (familyModels.length === 0) return;
        familyModels.sort((a, b) => {
          if (a.isLatestAlias && !b.isLatestAlias) return -1;
          if (!a.isLatestAlias && b.isLatestAlias) return 1;
          if (a.dateSuffix && b.dateSuffix)
            return b.dateSuffix.getTime() - a.dateSuffix.getTime();
          if (a.dateSuffix && !b.dateSuffix) return -1;
          if (!a.dateSuffix && b.dateSuffix) return 1;

          const aNum =
            a.numericSuffix === null || a.numericSuffix === undefined
              ? -Infinity
              : a.numericSuffix;
          const bNum =
            b.numericSuffix === null || b.numericSuffix === undefined
              ? -Infinity
              : b.numericSuffix;
          if (aNum !== -Infinity && bNum !== -Infinity) return bNum - aNum;
          if (aNum !== -Infinity && bNum === -Infinity) return -1;
          if (aNum === -Infinity && bNum !== -Infinity) return 1;

          return (b.version || '').localeCompare(a.version || '');
        });
        finalModelsToReturn.push(familyModels[0]);
      });
      console.log(
        `[API /list-models] After latestOnly filter: ${finalModelsToReturn.length} models.`
      );
    } else {
      finalModelsToReturn = augmentedAndPrunedModels;
    }

    const outputFormattedModels = finalModelsToReturn.map(
      ({
        baseName,
        isLatestAlias,
        dateSuffix,
        numericSuffix,
        isPreview,
        isExperimental,
        supportedGenerationMethods,
        ...rest
      }) => {
        let finalDisplayName = rest.displayName || rest.name;
        const nameLower = (rest.name || '').toLowerCase();
        const displayNameLower = finalDisplayName.toLowerCase();

        if (
          (isPreview || nameLower.includes('-preview-')) &&
          !displayNameLower.includes('preview')
        ) {
          finalDisplayName = `${finalDisplayName} (Preview)`;
        } else if (
          (isExperimental || nameLower.includes('-exp-')) &&
          !displayNameLower.includes('experimental') &&
          !displayNameLower.includes('exp')
        ) {
          finalDisplayName = `${finalDisplayName} (Experimental)`;
        }
        return { ...rest, displayName: finalDisplayName };
      }
    );

    outputFormattedModels.sort((a, b) => {
      const isALatest = a.name.includes('-latest');
      const isBLatest = b.name.includes('-latest');
      if (isALatest && !isBLatest) return -1;
      if (!isALatest && isBLatest) return 1;
      const isA25 = a.name.includes('2.5');
      const isB25 = b.name.includes('2.5');
      if (isA25 && !isB25) return -1;
      if (!isA25 && isB25) return 1;
      const isA15 = a.name.includes('1.5');
      const isB15 = b.name.includes('1.5');
      if (isA15 && !isB15) return -1;
      if (!isA15 && isB15) return 1;
      const isAPro = a.name.includes('-pro');
      const isBPro = b.name.includes('-pro');
      if (isAPro && !isBPro) return -1;
      if (!isAPro && isBPro) return 1;
      const isAFlash = a.name.includes('-flash');
      const isBFlash = b.name.includes('-flash');
      if (isAFlash && !isBFlash) return -1;
      if (!isAFlash && isBFlash) return 1;
      return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    });

    return NextResponse.json(
      { models: outputFormattedModels },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[API /list-models] Error in GET handler:', errorMessage);
    return NextResponse.json(
      { error: `Failed to fetch models: ${errorMessage}` },
      { status: 500 }
    );
  }
}
