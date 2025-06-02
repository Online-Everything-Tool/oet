// FILE: app/page.tsx
import fs from 'fs/promises';
import path from 'path';
import React, { Suspense } from 'react';
import { ParamConfig, ToolMetadata } from '@/src/types/tools.js';

import GatedContentLoader from './_components/GatedContentLoader';
const HomeClient = React.lazy(
  () => import('./tool/home/_components/HomeClient')
);

export interface ToolDisplayData {
  href: string;
  title: string;
  description: string;
}

async function getAvailableTools(): Promise<ToolDisplayData[]> {
  const toolsDirPath = path.join(process.cwd(), 'app', 'tool');
  const dynamicTools: ToolDisplayData[] = [];
  try {
    const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        const directive = entry.name;
        const metadataPath = path.join(
          toolsDirPath,
          directive,
          'metadata.json'
        );
        try {
          await fs.access(metadataPath);
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const metadata: ToolMetadata = JSON.parse(metadataContent);
          if (
            metadata.title &&
            metadata.description &&
            metadata.includeInSitemap !== false
          ) {
            dynamicTools.push({
              href: `/tool/${directive}/`,
              title: metadata.title,
              description: metadata.description,
            });
          } else if (!metadata.title || !metadata.description) {
            console.warn(
              `[Page Load] Metadata missing title or description for tool: ${directive}`
            );
          }
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          const isFsError =
            typeof error === 'object' && error !== null && 'code' in error;
          const errorCode = isFsError ? (error as { code: string }).code : null;
          if (errorCode !== 'ENOENT') {
            console.error(
              `[Page Load] Error processing metadata for tool '${directive}':`,
              message
            );
          } else {
            console.warn(
              `[Page Load] Metadata file not found for tool: ${directive}`
            );
          }
        }
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Page Load] Error reading tools directory:', message);
    return [];
  }
  dynamicTools.sort((a, b) => a.title.localeCompare(b.title));
  return dynamicTools;
}

const HomeClientCodeLoadingFallback = () => (
  <div className="text-center p-10 animate-pulse text-gray-500 text-lg">
    Preparing OET Dashboard Module...
  </div>
);

const InitialHomepageCTAFallback = () => (
  <div className="text-center py-10 px-4 md:px-6 space-y-6 rounded-lg bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 shadow-lg">
    <h2 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400">
      Welcome to OET!
    </h2>
    <p className="text-lg text-gray-700 max-w-2xl mx-auto">
      Click below to unveil your personalized OET experience and launch the
      dashboard.
    </p>
    <div className="h-12 w-72 bg-gray-200 animate-pulse rounded-md mx-auto mt-4"></div>{' '}
    {/* Button Placeholder improved */}
  </div>
);

export default async function Home() {
  const availableTools = await getAvailableTools();

  const handleGenerateNarrativeAndOpenGate = async (): Promise<boolean> => {
    'use server';
    console.log('Attempting to generate narrative and open gate...');
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Narrative fetched (simulated), opening gate.');
      return true;
    } catch (error) {
      console.error('Failed to generate narrative for gate:', error);
      return false;
    }
  };

  const homeClientContent = (
    <Suspense fallback={<HomeClientCodeLoadingFallback />}>
      <HomeClient initialTools={availableTools} />
    </Suspense>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">
      <div className="relative flex flex-col gap-4">
        <GatedContentLoader
          childrenToLoad={homeClientContent}
          onButtonClick={handleGenerateNarrativeAndOpenGate}
          buttonText="🚀 Launch OET Dashboard & Unveil Narrative 🚀"
          gateClosedFallback={<InitialHomepageCTAFallback />}
          mainSuspenseFallback={<HomeClientCodeLoadingFallback />}
          initialButtonLoadingText="Unveiling..."
        />
      </div>
    </div>
  );
}
