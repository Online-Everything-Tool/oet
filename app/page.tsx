// FILE: app/page.tsx
import React, { Suspense } from 'react';
import fs from 'fs/promises';
import path from 'path';
import HomePageClient from './_components/HomePageClient';
import { ToolDisplayData } from './_components/ToolListWidget';
import type { ToolMetadata } from '@/src/types/tools';

async function getHomePageData() {
  try {
    const allMetadataPath = path.join(
      process.cwd(),
      'public',
      'api',
      'all-tool-metadata.json'
    );
    const projectAnalysisPath = path.join(
      process.cwd(),
      'public',
      'data',
      'project_analysis.json'
    );

    const metadataContent = await fs.readFile(allMetadataPath, 'utf-8');
    const allMetadata: Record<string, ToolMetadata> =
      JSON.parse(metadataContent);

    const initialTools: ToolDisplayData[] = Object.values(allMetadata)
      .filter(
        (tool) =>
          tool.includeInSitemap !== false && tool.title && tool.description
      )
      .map((tool) => ({
        href: `/tool/${tool.directive}/`,
        title: tool.title,
        description: tool.description,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    let projectAnalysis = null;
    try {
      const analysisContent = await fs.readFile(projectAnalysisPath, 'utf-8');
      const data = JSON.parse(analysisContent);
      projectAnalysis = {
        suggestedDirectives: data.suggestedNewToolDirectives || [],
        modelNameUsed: data.modelNameUsed || null,
      };
    } catch (error) {
      console.warn('Could not load project_analysis.json on server:', error);
      projectAnalysis = { suggestedDirectives: [], modelNameUsed: null };
    }

    return { initialTools, projectAnalysis };
  } catch (error) {
    console.error('Failed to load data for Home page on server:', error);
    return {
      initialTools: [],
      projectAnalysis: { suggestedDirectives: [], modelNameUsed: null },
    };
  }
}

export default async function Home() {
  const { initialTools, projectAnalysis } = await getHomePageData();

  return (
    <Suspense fallback={<></>}>
      <HomePageClient
        initialTools={initialTools}
        projectAnalysis={projectAnalysis}
      />
    </Suspense>
  );
}
