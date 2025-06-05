// FILE: app/page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import useToolState from './tool/_hooks/useToolState';
import ToolListWidget from './_components/ToolListWidget';
import BuildToolWidget from './_components/BuildToolWidget';
import { useMetadata } from './context/MetadataContext';

export interface ToolDisplayData {
  href: string;
  title: string;
  description: string;
}

interface HomeToolState {
  terms: boolean;
}

const DEFAULT_HOME_STATE: HomeToolState = {
  terms: false,
};

export default function Home(/*{ initialTools }: HomeClientProps*/) {
  const toolRouteForState = `/tool/home`;

  const {
    state: homePersistentState,
    setState: setHomePersistentState,
    isLoadingState: isLoadingToolSavedState,
  } = useToolState<HomeToolState>(toolRouteForState, DEFAULT_HOME_STATE);

  const [projectAnalysis, setProjectAnalysis] = useState<{
    suggestedDirectives: string[];
    modelNameUsed: string | null;
  } | null>(null);

  const [isLoadingProjectAnalysis, setIsLoadingProjectAnalysis] =
    useState(true);

  const { getAllToolMetadataArray, isLoading: isLoadingMetadata } =
    useMetadata();

  useEffect(() => {
    const fetchProjectAnalysis = async () => {
      setIsLoadingProjectAnalysis(true);
      try {
        const response = await fetch('/data/project_analysis.json');
        if (!response.ok) {
          throw new Error(
            `Failed to fetch project analysis: ${response.status}`
          );
        }
        const data = await response.json();
        setProjectAnalysis({
          suggestedDirectives: data.suggestedNewToolDirectives || [],
          modelNameUsed: data.modelNameUsed || null,
        });
      } catch (error) {
        console.error('Error fetching project_analysis.json:', error);

        setProjectAnalysis({ suggestedDirectives: [], modelNameUsed: null });
      } finally {
        setIsLoadingProjectAnalysis(false);
      }
    };
    fetchProjectAnalysis();
  }, []);

  const initialToolsForWidget: ToolDisplayData[] = useMemo(() => {
    if (isLoadingMetadata) {
      return [];
    }
    const allMeta = getAllToolMetadataArray();
    return allMeta
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
  }, [getAllToolMetadataArray, isLoadingMetadata]);

  const isPageContentLoading =
    isLoadingProjectAnalysis || isLoadingMetadata || isLoadingToolSavedState;

  if (isPageContentLoading) {
    return (
      <div className="space-y-10 animate-pulse">
        {/* Placeholder for ToolListWidget */}
        <div className="p-4 md:p-6 border rounded-lg bg-gray-100 dark:bg-gray-700 shadow-sm h-72">
          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-5/6"></div>
        </div>
        {/* Placeholder for BuildToolWidget */}
        <div className="p-4 md:p-6 border rounded-lg bg-gray-100 dark:bg-gray-700 shadow-sm h-56">
          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ToolListWidget initialTools={initialToolsForWidget} />
      <BuildToolWidget
        suggestedDirectives={projectAnalysis?.suggestedDirectives || []}
        modelNameUsed={projectAnalysis?.modelNameUsed}
      />
      {/* IntroPromotionalModal will be added here later */}
    </div>
  );
}
