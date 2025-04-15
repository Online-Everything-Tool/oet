// FILE: /app/page.tsx
import Link from 'next/link';
import fs from 'fs/promises'; // Filesystem module
import path from 'path';     // Path module
import ClientOnly from '@/app/_components/ClientOnly'; // Import ClientOnly
import RecentlyUsedWidget from '@/app/_components/RecentlyUsedWidget'; // Import the new widget

// --- Interfaces (Unchanged) ---
interface ToolMetadata {
  title: string;
  description: string;
  includeInSitemap?: boolean; // Make optional for safety
}

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

// --- Helper function to fetch tool metadata (Unchanged) ---
async function getAvailableTools(): Promise<ToolDisplayData[]> {
  const toolsDirPath = path.join(process.cwd(), 'app', 't');
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
          // Only add if title/description exist and it should be shown (default true)
          if (metadata.title && metadata.description && metadata.includeInSitemap !== false) {
            dynamicTools.push({
              href: `/t/${directive}/`, // Add trailing slash
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

// --- Helper function to fetch project analysis data (Unchanged) ---
async function getProjectAnalysisData(): Promise<ProjectAnalysisData | null> {
  const analysisFilePath = path.join(process.cwd(), 'public', 'data', 'project_analysis.json');
  try {
    await fs.access(analysisFilePath);
    const analysisContent = await fs.readFile(analysisFilePath, 'utf-8');
    const data: ProjectAnalysisData = JSON.parse(analysisContent);
    if (data.siteDescription && data.suggestedNewToolDirectives) {
        return data;
    } else {
        console.warn("[Page Load] project_analysis.json is missing required fields.");
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

        {/* Welcome Header (Unchanged) */}
        <div className="text-center border-b border-[rgb(var(--color-border-base))] pb-6 mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-[rgb(var(--color-text-base))] mb-2">
                Online Everything Tool
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

        {/* --- Recently Used Tools Section (NEW) --- */}
        <ClientOnly>
            <RecentlyUsedWidget limit={5} displayMode="homepage" />
        </ClientOnly>
        {/* --- End Recently Used Tools Section --- */}


        {/* Available Tools Section (Unchanged) */}
        <div className="p-4 md:p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-[rgb(var(--color-text-base))]">
                Available Tools:
            </h2>
            {availableTools && availableTools.length > 0 ? (
                <ul className="space-y-4">
                    {availableTools.map((tool) => (
                        <li key={tool.href} className="pb-3 border-b border-gray-200 last:border-b-0 last:pb-0">
                            <Link
                                href={tool.href}
                                className="block text-lg font-medium text-[rgb(var(--color-text-link))] hover:underline mb-1"
                            >
                                {tool.title}
                            </Link>
                            <p className="text-sm text-[rgb(var(--color-text-muted))]">
                                {tool.description}
                            </p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[rgb(var(--color-text-muted))]">No tools found or failed to load.</p>
            )}
        </div>

        {/* Build a New Tool Section (Unchanged) */}
        <div className="p-4 md:p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm space-y-4">
            <div>
                <h2 className="text-xl font-semibold mb-3 text-[rgb(var(--color-text-base))]">
                    Build a New Tool
                </h2>
                <p className="text-[rgb(var(--color-text-muted))] mb-4">
                    Have an idea for another useful client-side utility? Build it with AI assistance!
                </p>
                <Link
                    href="/build-tool/" // Ensure trailing slash
                    className="inline-block px-5 py-2 bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] font-medium text-sm rounded-md shadow-sm hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors"
                >
                    Build a Tool
                </Link>
                <p className="text-[rgb(var(--color-text-muted))] mt-4">
                    Use AI (Gemini) to validate the directive and attempt to generate a proof-of-concept tool. Successful generations will result in a pull request for review and potential inclusion in the site.
                </p>
            </div>

            {suggestedDirectives.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-md font-semibold text-gray-700 mb-2">
                        Need Inspiration? AI Suggestions:
                    </h3>
                    <ul className="list-disc list-inside space-y-1">
                        {suggestedDirectives.map((directive) => (
                            <li key={directive} className="text-sm">
                                <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">
                                    {directive}
                                </code>
                            </li>
                        ))}
                    </ul>
                     {analysisData?.modelNameUsed && (
                       <p className="text-xs text-gray-400 mt-2">Suggestions generated using {analysisData.modelNameUsed}</p>
                     )}
                </div>
            )}
        </div>
    </div>
  );
}