// FILE: app/page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import useToolState from './tool/_hooks/useToolState';
import ToolListWidget from './_components/ToolListWidget';
import BuildToolWidget from './_components/BuildToolWidget';
import { useMetadata } from './context/MetadataContext'; // Import useMetadata

export interface ToolDisplayData {
  href: string;
  title: string;
  description: string;
}

// HomeClientProps is no longer needed if initialTools is not passed as a prop
// interface HomeClientProps {
//   initialTools: ToolDisplayData[];
// }

interface HomeToolState {
  terms: boolean; // For now, will be introModalPermanentlyDismissed later
  // introModalPermanentlyDismissed?: boolean; // Example for later
}

const DEFAULT_HOME_STATE: HomeToolState = {
  terms: false,
  // introModalPermanentlyDismissed: false, // Example for later
};

export default function Home(/*{ initialTools }: HomeClientProps*/) {
  // initialTools prop removed
  const toolRouteForState = `/tool/home`;

  const {
    state: homePersistentState,
    setState: setHomePersistentState,
    isLoadingState: isLoadingToolSavedState,
    // errorLoadingState: toolStateError, // If you need to display this error
  } = useToolState<HomeToolState>(toolRouteForState, DEFAULT_HOME_STATE);

  const [projectAnalysis, setProjectAnalysis] = useState<{
    suggestedDirectives: string[];
    modelNameUsed: string | null;
  } | null>(null);

  const [isLoadingProjectAnalysis, setIsLoadingProjectAnalysis] =
    useState(true);

  // Use MetadataContext to get tool metadata
  const {
    getAllToolMetadataArray,
    isLoading: isLoadingMetadata,
    // error: metadataError, // If you need to display this error
  } = useMetadata();

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
        // Set a default or empty state for projectAnalysis on error
        setProjectAnalysis({ suggestedDirectives: [], modelNameUsed: null });
      } finally {
        setIsLoadingProjectAnalysis(false);
      }
    };
    fetchProjectAnalysis();
  }, []); // Empty dependency array means this runs once on mount

  // Derive initialTools for ToolListWidget from metadata
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

  // Determine overall loading state for the page content
  const isPageContentLoading =
    isLoadingProjectAnalysis || isLoadingMetadata || isLoadingToolSavedState;

  if (isPageContentLoading) {
    // A more specific loading skeleton could be beneficial
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
    <div className="space-y-10">
      <ToolListWidget initialTools={initialToolsForWidget} />
      <BuildToolWidget
        suggestedDirectives={projectAnalysis?.suggestedDirectives || []}
        modelNameUsed={projectAnalysis?.modelNameUsed}
      />
      {/* IntroPromotionalModal will be added here later */}
    </div>
  );
}
