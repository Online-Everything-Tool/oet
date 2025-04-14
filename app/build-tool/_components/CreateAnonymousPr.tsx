// /app/build-tool/_components/CreateAnonymousPr.tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
// Keep the import as LibraryDependency is now used
import type { GenerationResult, ValidationResult, PrSubmissionResult, LibraryDependency } from '../page';

// Props remain the same
interface CreateAnonymousPrProps {
    toolDirective: string;
    generationResult: GenerationResult;
    validationResult: ValidationResult;
    additionalDescription: string;
    userSelectedDirective: string | null;
    onPrSubmissionSuccess: (result: PrSubmissionResult) => void;
    onBack: () => void;
}

interface ApiPrSubmissionResponseData {
    success: boolean;
    message: string;
    url?: string | null;
}

export default function CreateAnonymousPr({
    toolDirective,
    generationResult,
    validationResult,
    additionalDescription,
    userSelectedDirective,
    onPrSubmissionSuccess,
    onBack
}: CreateAnonymousPrProps) {

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'error'>('idle');
    const [expandedFilePath, setExpandedFilePath] = useState<string | null>(null);

    const mainFilePath = useMemo(() => `app/t/${toolDirective}/page.tsx`, [toolDirective]);
    const mainFileContent = useMemo(() => {
        return generationResult.generatedFiles?.[mainFilePath] ?? null;
    }, [generationResult.generatedFiles, mainFilePath]);

    const sortedFilePaths = useMemo(() => {
        if (!generationResult.generatedFiles) return [];
        const paths = Object.keys(generationResult.generatedFiles);
        return paths.sort((a, b) => {
            if (a === mainFilePath) return -1;
            if (b === mainFilePath) return 1;
            return a.localeCompare(b);
        });
    }, [generationResult.generatedFiles, mainFilePath]);

    useEffect(() => {
        if (mainFileContent !== null) {
            setExpandedFilePath(mainFilePath);
        } else {
            setExpandedFilePath(null);
        }
    }, [mainFilePath, mainFileContent]);

    // --- Handle PR Submission (No changes needed) ---
    const handleAnonymousSubmitClick = async () => {
        // ... (submission logic remains the same)
         setStatus('idle'); setFeedback(null);

        if (!generationResult.generatedFiles || !mainFileContent) {
             setStatus('error'); setFeedback(`Error: Required generated file (${mainFilePath}) is missing.`); return;
        }
        if (!toolDirective) {
            setStatus('error'); setFeedback('Error: Tool directive is missing.'); return;
        }
        if (!validationResult?.generativeDescription) {
            console.warn("[PR Submit] Generative description missing, PR body might be less informative.");
        }

        setIsSubmitting(true);
        setFeedback('Submitting Pull Request to GitHub (anonymously)...');

        try {
            const response = await fetch('/api/create-anonymous-pr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toolDirective: toolDirective,
                    generatedFiles: generationResult.generatedFiles,
                    identifiedDependencies: generationResult.identifiedDependencies || [],
                    generativeDescription: validationResult.generativeDescription || `AI-generated code for ${toolDirective}`,
                    additionalDescription: additionalDescription || '',
                    generativeRequestedDirectives: validationResult.generativeRequestedDirectives || [],
                    userSelectedExampleDirective: userSelectedDirective,
                }),
            });

            const data: ApiPrSubmissionResponseData = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || `PR submission failed (${response.status})`);
            }
            onPrSubmissionSuccess({ message: data.message, prUrl: data.url || null });
            setFeedback(null); setStatus('idle');
        } catch (error: unknown) {
            console.error("Anonymous PR Submission Error:", error);
            setStatus('error');
            const message = error instanceof Error ? error.message : "Unexpected error during PR submission.";
            setFeedback(`PR Submission Error: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleFileExpansion = (filePath: string) => {
        setExpandedFilePath(currentPath => (currentPath === filePath ? null : filePath));
    };


    // --- Render Logic ---
    return (
         <section className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isSubmitting ? 'opacity-70' : ''} ${status === 'error' ? 'border-red-300' : 'border-purple-300'}`}>
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Step 3: Review & Submit Anonymous PR</h2>

            {/* Generation Feedback */}
            {generationResult.message && ( <p className={`text-sm mb-4 p-2 rounded ${ generationResult.message.toLowerCase().includes('warning') ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : generationResult.message.toLowerCase().includes('error') ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200' }`}> {generationResult.message} </p> )}

            {/* Review Context Section */}
            <div className="mb-4 space-y-3 p-3 bg-gray-50 border border-gray-200 rounded">
                 <h3 className="text-base font-semibold text-gray-700 mb-2">Generation Context Review</h3>
                 <p className="text-sm"> <span className="font-medium text-gray-600">Target Directive:</span>{' '} <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{toolDirective}</code> </p>
                 {validationResult?.generativeDescription && (<div> <p className="text-sm font-medium text-gray-600">AI Description:</p> <blockquote className="text-sm text-gray-800 pl-2 italic border-l-2 border-gray-300 ml-1 my-1"> “{validationResult.generativeDescription}” </blockquote> </div>)}
                 {validationResult?.generativeRequestedDirectives && validationResult.generativeRequestedDirectives.length > 0 && (<div> <p className="text-sm font-medium text-gray-600 mb-1">AI Requested Examples:</p> <ul className="list-disc list-inside space-y-1 pl-2">{validationResult.generativeRequestedDirectives.map(d => ( <li key={d} className="text-sm text-indigo-700"><Link href={`/t/${d}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900 font-mono text-xs">{d}</Link></li> ))}</ul> </div>)}
                 <div> <p className="text-sm font-medium text-gray-600">Additional Details:</p> {additionalDescription ? (<p className="text-sm text-gray-800 pl-2 whitespace-pre-wrap bg-gray-100 p-2 rounded border border-gray-200 font-mono text-xs">{additionalDescription}</p>) : (<p className="text-sm text-gray-500 pl-2 italic">(None provided)</p>)} </div>
                 <div> <p className="text-sm font-medium text-gray-600 mb-1">User Selected Example:</p> {userSelectedDirective ? (<ul className="list-disc list-inside space-y-1 pl-2"><li className="text-sm text-purple-700"><Link href={`/t/${userSelectedDirective}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-900 font-mono text-xs">{userSelectedDirective}</Link></li></ul>) : (<p className="text-sm text-gray-500 pl-2 italic">(None selected)</p>)} </div>

                 {/* Dependencies Display (Always show section header) */}
                 <div className="pt-2 border-t border-gray-200 mt-2">
                     <p className="text-sm font-medium text-gray-600 mb-1">Potentially Required Dependencies:</p>
                     {generationResult.identifiedDependencies && generationResult.identifiedDependencies.length > 0 ? (
                         <ul className="list-disc list-inside space-y-1 pl-2">
                             {/* Explicitly type 'dep' here to satisfy ESLint */}
                             {generationResult.identifiedDependencies.map((dep: LibraryDependency) => (
                                 <li key={dep.packageName} className="text-sm text-gray-700">
                                     <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{dep.packageName}</code>
                                     {dep.reason && <span className="text-xs italic text-gray-500"> - {dep.reason}</span>}
                                 </li>
                             ))}
                         </ul>
                     ) : (
                         <p className="text-sm text-gray-500 pl-2 italic">(None identified)</p>
                     )}
                     {generationResult.identifiedDependencies && generationResult.identifiedDependencies.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">Note: These may need to be added to `package.json` manually if not already present.</p>
                     )}
                 </div>
            </div>

             {/* Generated Files Display (Expandable - No changes needed here) */}
             <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                     Generated Files Preview:
                 </label>
                 {sortedFilePaths.length > 0 ? (
                     <div className="space-y-2">
                         {sortedFilePaths.map((filePath) => {
                             const isExpanded = expandedFilePath === filePath;
                             const fileContent = generationResult.generatedFiles?.[filePath];
                             const isMainFile = filePath === mainFilePath;

                             return (
                                 <div key={filePath} className={`border rounded ${isExpanded ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'} overflow-hidden`}>
                                     <button type="button" onClick={() => toggleFileExpansion(filePath)} className="w-full text-left px-3 py-2 flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded-t" aria-expanded={isExpanded}>
                                         <code className={`text-sm font-mono ${isExpanded ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}>{filePath}</code>
                                         <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                         </span>
                                     </button>
                                     {isExpanded && (
                                         <div className="px-1 pb-1 bg-gray-900">
                                             {fileContent !== null && fileContent !== undefined ? (
                                                 <textarea readOnly value={fileContent} rows={isMainFile ? 20 : 10} className="block w-full p-2 border-t border-gray-700 bg-gray-900 text-gray-100 font-mono text-xs resize-y focus:outline-none" spellCheck="false" />
                                             ) : (
                                                  <div className="p-4 text-red-200 text-xs italic"> (Content missing for this file) </div>
                                              )}
                                         </div>
                                     )}
                                 </div>
                             );
                          })}
                     </div>
                 ) : (
                      <div className="p-4 border border-dashed border-red-300 rounded bg-red-50 text-red-700 text-sm"> Error: No files were generated or found in the generation result. Cannot proceed with submission. </div>
                  )}
                 <p className="mt-2 text-xs text-gray-500">Click file names to expand/collapse content. Review before submitting.</p>
             </div>


             {/* Buttons */}
             <div className="flex items-center justify-between flex-wrap gap-4">
                 <button type="button" onClick={handleAnonymousSubmitClick} disabled={isSubmitting || !generationResult.generatedFiles || mainFileContent === null} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"> {isSubmitting ? 'Submitting Anonymously...' : 'Submit Anonymous PR'} </button>
                 <button type="button" onClick={onBack} disabled={isSubmitting} className="text-sm text-gray-600 hover:text-gray-900 underline disabled:opacity-50"> Back to Generation </button>
             </div>

             {/* Feedback Area */}
             {feedback && ( <div className={`mt-4 text-sm p-3 rounded ${ status === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200' }`}>{feedback}</div> )}
        </section>
    );
}