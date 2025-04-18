// /app/build-tool/_components/GenerateToolResources.tsx
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
// Import necessary types, including the new API response type if needed
import type { ValidationResult, GenerationResult, ApiGenerationResponseData } from '@/src/types/build';

// --- Updated Props expected by this component ---
interface GenerateToolResourcesProps {
    toolDirective: string;
    validationResult: ValidationResult;
    additionalDescription: string;
    setAdditionalDescription: (value: string) => void;
    selectedModel: string;
    allAvailableToolDirectives: string[];
    userSelectedDirectives: string[]; // Changed from string | null
    setUserSelectedDirectives: React.Dispatch<React.SetStateAction<string[]>>; // Changed setter type
    onGenerationSuccess: (result: GenerationResult) => void;
    onBack: () => void;
}

// ApiGenerationResponseData removed (defined in types/build.ts)

export default function GenerateToolResources({
    toolDirective,
    validationResult,
    additionalDescription, setAdditionalDescription,
    selectedModel,
    allAvailableToolDirectives,
    userSelectedDirectives,   // Use array prop
    setUserSelectedDirectives, // Use array setter prop
    onGenerationSuccess, onBack
}: GenerateToolResourcesProps) { // Use updated props type

    const [isGenerating, setIsGenerating] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'error'>('idle');
    const MAX_USER_EXAMPLES = 5;

    // Calculate available choices for the user (tools NOT suggested by AI)
    const availableUserChoices = useMemo(() => {
        const aiDirectives = new Set(validationResult.generativeRequestedDirectives || []);
        // Filter out AI suggestions and sort alphabetically
        return allAvailableToolDirectives
                .filter(dir => !aiDirectives.has(dir))
                .sort((a, b) => a.localeCompare(b));
    }, [allAvailableToolDirectives, validationResult.generativeRequestedDirectives]);

    // Handler for checkbox changes
    const handleUserExampleSelectionChange = useCallback((directive: string, isChecked: boolean) => {
        setUserSelectedDirectives(prevSelected => {
            const currentSet = new Set(prevSelected);
            if (isChecked) {
                // Add only if limit not reached
                if (currentSet.size < MAX_USER_EXAMPLES) {
                    currentSet.add(directive);
                } else {
                    // Optional: Provide feedback that the limit is reached
                    console.warn(`User example limit (${MAX_USER_EXAMPLES}) reached.`);
                    // Return previous state unmodified to prevent adding more
                    return prevSelected;
                }
            } else {
                // Remove if unchecked
                currentSet.delete(directive);
            }
            // Return the array version of the updated set
            return Array.from(currentSet);
        });
    }, [setUserSelectedDirectives]);


    // Handle Generation API Call - Updated payload
    const handleGenerateClick = async () => {
        setStatus('idle');
        setFeedback(null);
        setIsGenerating(true);
        setFeedback('Generating files via API...');

        if (!selectedModel) {
            setStatus('error'); setFeedback('Error: AI model selection missing.'); setIsGenerating(false); return;
        }
        if (!validationResult.generativeDescription) {
            setStatus('error'); setFeedback('Error: AI-generated description is missing.'); setIsGenerating(false); return;
        }

        try {
            const response = await fetch('/api/generate-tool-resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toolDirective: toolDirective,
                    generativeDescription: validationResult.generativeDescription,
                    additionalDescription: additionalDescription.trim(),
                    modelName: selectedModel,
                    generativeRequestedDirectives: validationResult.generativeRequestedDirectives || [], // Ensure array
                    // Pass the array of user-selected directives
                    userSelectedExampleDirectives: userSelectedDirectives // Use array state
                }),
            });

            const data: ApiGenerationResponseData = await response.json();

            if (!response.ok || !data.success) {
                 throw new Error(data.message || `API request failed (${response.status})`);
            }

            if (data.generatedFiles && Object.keys(data.generatedFiles).length > 0) {
                 console.log("API call successful, received generated files and dependencies.");
                 onGenerationSuccess({
                     message: data.message,
                     generatedFiles: data.generatedFiles,
                     identifiedDependencies: data.identifiedDependencies
                 });
                 setFeedback(null);
                 setStatus('idle');
             } else {
                 console.error("API reported success but returned no generated files.");
                 throw new Error(data.message || "Generation failed: API reported success but generated files were missing.");
             }

        } catch (error: unknown) {
            console.error("Tool Resource Generation Error:", error);
            setStatus('error');
            const message = error instanceof Error ? error.message : "Unexpected error during resource generation.";
            setFeedback(`Generation Error: ${message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // JSX Render Logic - Modified User Example Selection
    return (
         <section className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isGenerating ? 'opacity-70' : ''} ${status === 'error' ? 'border-red-300' : 'border-indigo-300'}`}>
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Step 2: Refine & Generate Resources</h2>
             <div className="mb-4">
                <label htmlFor="genDescDisplay" className="block text-sm font-medium text-gray-700 mb-1"> AI Generated Description (Review): </label>
                <textarea id="genDescDisplay" readOnly value={validationResult.generativeDescription} rows={3} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 sm:text-sm resize-y" />
             </div>

             {/* Display AI Requested Examples */}
             {(validationResult.generativeRequestedDirectives?.length ?? 0) > 0 && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded">
                    <p className="text-sm font-medium text-indigo-800 mb-1"> AI Requested Implementation Examples ({validationResult.generativeRequestedDirectives.length}): </p>
                    <ul className="list-disc list-inside space-y-1 text-xs columns-2 sm:columns-3">
                        {validationResult.generativeRequestedDirectives.map(directive => (
                            <li key={directive} className="text-indigo-700 font-mono">
                                <Link href={`/tool/${directive}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">
                                    {directive}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
             )}

             {/* User Selectable Examples (Checkboxes) */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2"> Select Additional Examples (Optional, Max {MAX_USER_EXAMPLES}): </label>
                {availableUserChoices.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded p-2 space-y-1 bg-gray-50 columns-2 sm:columns-3">
                        {availableUserChoices.map(directive => {
                            const isChecked = userSelectedDirectives.includes(directive);
                            const isDisabled = !isChecked && userSelectedDirectives.length >= MAX_USER_EXAMPLES;
                            return (
                                <div key={directive} className="flex items-center break-inside-avoid">
                                    <input
                                        id={`user-choice-${directive}`}
                                        type="checkbox"
                                        value={directive}
                                        checked={isChecked}
                                        disabled={isDisabled || isGenerating}
                                        onChange={(e) => handleUserExampleSelectionChange(directive, e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50 accent-purple-600"
                                    />
                                    <label
                                        htmlFor={`user-choice-${directive}`}
                                        className={`ml-2 block text-xs font-mono ${isDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer'}`}
                                    >
                                        {directive}
                                    </label>
                                </div>
                            );
                         })}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic">(No other tools available to select as examples)</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                    Choose existing tools (up to {MAX_USER_EXAMPLES}) if their code provides relevant patterns.
                     {userSelectedDirectives.length >= MAX_USER_EXAMPLES && <span className='text-purple-600 font-medium'> Max selected.</span>}
                </p>
            </div>

            {/* Additional Details Input */}
            <div className="mb-4">
                <label htmlFor="additionalDescription" className="block text-sm font-medium text-gray-700 mb-1"> Additional Details / Refinements (Optional): </label>
                <textarea id="additionalDescription" value={additionalDescription} onChange={(e)=>setAdditionalDescription(e.target.value)} rows={4} disabled={isGenerating} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-y disabled:bg-gray-100" placeholder="Add specific details, edge cases, UI preferences, libraries to avoid..." />
                 <p className="mt-1 text-xs text-gray-500">Provide extra context to help the AI generate the necessary code files.</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                 <button type="button" onClick={handleGenerateClick} disabled={isGenerating} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" > {isGenerating ? 'Generating Files...' : 'Generate Tool Files'} </button>
                 <button type="button" onClick={onBack} disabled={isGenerating} className="text-sm text-gray-600 hover:text-gray-900 hover:underline disabled:opacity-50" > Back to Validation </button>
            </div>

            {/* Feedback Area */}
             {feedback && ( <div className={`mt-4 text-sm p-3 rounded ${ status === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200' }`}> {feedback} </div> )}
        </section>
    );
}