// FILE: app/tool/home/_components/HomeClient.tsx
'use client';

import React, { useEffect, useState } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';

import BuildToolWidget from '@/app/_components/BuildToolWidget';
import RecentBuildsWidget from '@/app/_components/RecentBuildsWidget';
import ToolListWidget from '@/app/_components/ToolListWidget';
import { ToolDisplayData } from '@/app/page';

interface HomeClientProps {
  initialTools: ToolDisplayData[];
}

interface HomeToolState {
  terms: boolean;
}

const DEFAULT_HOME_STATE: HomeToolState = {
  terms: false,
};

export default function HomeClient({ initialTools }: HomeClientProps) {
  const toolRouteForState = `/tool/home`;

  const {
    state,
    setState,
    isLoadingState: isLoadingToolSavedState,
  } = useToolState<HomeToolState>(toolRouteForState, DEFAULT_HOME_STATE);

  const [projectAnalysis, setProjectAnalysis] = useState<{
    suggestedDirectives: string[];
    modelNameUsed: string | null;
  } | null>(null);
  const [isLoadingProjectAnalysis, setIsLoadingProjectAnalysis] =
    useState(true);

  useEffect(() => {
    const fetchProjectAnalysis = async () => {
      setIsLoadingProjectAnalysis(true);
      try {
        const response = await fetch('/data/project_analysis.json');
        if (!response.ok)
          throw new Error(
            `Failed to fetch project analysis: ${response.status}`
          );
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

  return (
    <div className="space-y-10">
      <ToolListWidget initialTools={initialTools} />
      <BuildToolWidget
        suggestedDirectives={projectAnalysis?.suggestedDirectives || []}
        modelNameUsed={projectAnalysis?.modelNameUsed}
      />
    </div>
  );
}
