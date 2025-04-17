// --- FILE: /app/page.tsx ---
import fs from 'fs/promises';
import path from 'path';
import RecentlyUsedWidget from '@/app/_components/RecentlyUsedWidget';
import FavoriteToolsWidget from '@/app/_components/FavoriteToolsWidget'; // Import the new widget
import ToolListWidget from '@/app/_components/ToolListWidget';
import BuildToolWidget from '@/app/_components/BuildToolWidget';
import { ToolMetadata } from '@/src/types/tools';

interface ToolDisplayData {
  href: string;
  title: string;
  description: string;
}

interface ProjectAnalysisData {
  siteTagline: string;
  siteDescription: string;
  siteBenefits: string[];
  suggestedNewToolDirectives: string[];
  modelNameUsed: string;
}

// --- Helper function getAvailableTools (Unchanged) ---
async function getAvailableTools(): Promise<ToolDisplayData[]> {
    const toolsDirPath = path.join(process.cwd(), 'app', 'tool');
    const dynamicTools: ToolDisplayData[] = [];
    try {
        const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('_')) {
                const directive = entry.name;
                const metadataPath = path.join(toolsDirPath, directive, 'metadata.json');
                try {
                    await fs.access(metadataPath);
                    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                    const metadata: ToolMetadata = JSON.parse(metadataContent);
                    if (metadata.title && metadata.description && metadata.includeInSitemap !== false) {
                        dynamicTools.push({
                        href: `/tool/${directive}/`,
                        title: metadata.title,
                        description: metadata.description,
                        });
                    } else if (!metadata.title || !metadata.description) {
                        console.warn(`[Page Load] Metadata missing title or description for tool: ${directive}`);
                    }
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    const isFsError = typeof error === 'object' && error !== null && 'code' in error;
                    const errorCode = isFsError ? (error as { code: string }).code : null;
                    if (errorCode !== 'ENOENT') {
                    console.error(`[Page Load] Error processing metadata for tool '${directive}':`, message);
                    } else {
                        console.warn(`[Page Load] Metadata file not found for tool: ${directive}`);
                    }
                }
            }
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Page Load] Error reading tools directory:", message);
        return [];
    }
    dynamicTools.sort((a, b) => a.title.localeCompare(b.title));
    return dynamicTools;
}

// --- Helper function getProjectAnalysisData (Unchanged) ---
async function getProjectAnalysisData(): Promise<ProjectAnalysisData | null> {
    const analysisFilePath = path.join(process.cwd(), 'public', 'data', 'project_analysis.json');
    try {
        await fs.access(analysisFilePath);
        const analysisContent = await fs.readFile(analysisFilePath, 'utf-8');
        const data: ProjectAnalysisData = JSON.parse(analysisContent);
        if (data.siteDescription && data.suggestedNewToolDirectives && data.siteTagline) {
            return data;
        } else {
            console.warn("[Page Load] project_analysis.json might be missing some fields (description, suggestions, tagline).");
            if (data.siteDescription && data.suggestedNewToolDirectives) return data;
            return null;
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isFsError = typeof error === 'object' && error !== null && 'code' in error;
        const errorCode = isFsError ? (error as { code: string }).code : null;
        if (errorCode === 'ENOENT') {
            console.log("[Page Load] project_analysis.json not found. Displaying default content.");
        } else {
            console.error("[Page Load] Error reading or parsing project_analysis.json:", message);
        }
        return null;
    }
}


// --- The Page Component (async) ---
export default async function Home() {

  const [availableTools, analysisData] = await Promise.all([
    getAvailableTools(),
    getProjectAnalysisData()
  ]);

  const pageDescription = analysisData?.siteDescription ?? "Your one-stop utility for client-side data transformations & generation.";
  const suggestedDirectives = analysisData?.suggestedNewToolDirectives ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">

        <div className="text-center border-b border-[rgb(var(--color-border-base))] pb-6 mb-6">
      
            <h1 className="text-3xl md:text-4xl font-bold text-[rgb(var(--color-text-base))] mb-2">
                <span className="line-through decoration-red-600 decoration-3">Online</span> Everything Tool
            </h1>
            <p className="text-lg text-[rgb(var(--color-text-muted))]">
                {pageDescription}
            </p>
            {analysisData?.siteTagline && (
                <p className="text-sm text-gray-500 mt-1 italic">“{analysisData.siteTagline}”</p>
            )}
             {analysisData?.modelNameUsed && (
                <p className="text-xs text-gray-400 mt-2">Analysis powered by {analysisData.modelNameUsed}</p>
             )}
        </div>

        <FavoriteToolsWidget />

        <RecentlyUsedWidget limit={5} displayMode="homepage" />

        <ToolListWidget initialTools={availableTools} />

        <BuildToolWidget
            suggestedDirectives={suggestedDirectives}
            modelNameUsed={analysisData?.modelNameUsed}
        />
    </div>
  );
}